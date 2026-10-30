"""Deterministic, model-independent compositors. Arrays are T,H,W,RGB float32."""
import json
import math
import numpy as np

EFFECTS = ('world_orchestra', 'impossible_duet', 'portal_paint',
           'reality_scrubber', 'foley_orchestra', 'future_echo', 'motion_becomes_matter')


def frames(x):
    a = np.asarray(x, dtype=np.float32)
    if a.ndim != 4 or a.shape[-1] < 3 or not all(a.shape):
        raise ValueError('Expected a nonempty T,H,W,RGB frame batch')
    if not np.isfinite(a).all():
        raise ValueError('Frames contain NaN or infinity')
    return np.clip(a[..., :3], 0, 1)


def align(x, count, height, width, source_fps=None, target_fps=None):
    """Nearest-neighbor spatial resize; temporal resampling holds the final frame."""
    x = frames(x)
    if source_fps and target_fps:
        ti = np.minimum((np.arange(count) * source_fps / target_fps).astype(int), len(x)-1)
    else:
        ti = np.minimum(np.arange(count), len(x)-1)
    yi = np.minimum((np.arange(height) * x.shape[1] / height).astype(int), x.shape[1]-1)
    xi = np.minimum((np.arange(width) * x.shape[2] / width).astype(int), x.shape[2]-1)
    return x[ti][:, yi][:, :, xi]


def mask_batch(x, count, height, width):
    x = np.asarray(x, dtype=np.float32)
    if x.ndim == 2:
        x = x[None]
    if x.ndim == 4:
        x = x[..., 0]
    if x.ndim != 3 or not all(x.shape) or not np.isfinite(x).all():
        raise ValueError('Mask must be H,W or T,H,W, with finite values')
    return align(np.repeat(x[..., None], 3, axis=-1), count, height, width)[..., :1]


def ellipse(height, width, cx=.5, cy=.5, rx=.28, ry=.38):
    y, x = np.mgrid[0:height, 0:width]
    d = ((x/max(width-1, 1)-cx)/rx)**2 + ((y/max(height-1, 1)-cy)/ry)**2
    return np.clip((1-d)*12, 0, 1).astype(np.float32)[..., None]


def shift(x, dx, dy=0):
    """Translate without wrapping pixels around the image."""
    out = np.zeros_like(x)
    h, w = x.shape[:2]
    if abs(dx) >= w or abs(dy) >= h:
        return out
    sx, ex = max(0, -dx), min(w, w-dx)
    sy, ey = max(0, -dy), min(h, h-dy)
    out[sy+dy:ey+dy, sx+dx:ex+dx] = x[sy:ey, sx:ex]
    return out


def beat_indices(count, fps, bpm, offset=0., times=''):
    if not np.isfinite(fps) or fps <= 0 or bpm <= 0:
        raise ValueError('FPS and BPM must be positive')
    if times.strip():
        try:
            t = [float(v.strip()) for v in times.split(',') if v.strip()]
        except ValueError as exc:
            raise ValueError('Beat times must be comma-separated seconds') from exc
        if not all(np.isfinite(t)):
            raise ValueError('Beat times must be finite')
    else:
        t = np.arange(offset, count/fps, 60./bpm).tolist()
    return sorted(set(int(round(v*fps)) for v in t if v >= 0 and round(v*fps) < count))


def reactive_bands(waveform, sample_rate, count, fps, bpm, offset=0., times=''):
    """Per-frame band RMS. Silence stays silent; a short track is zero-padded."""
    beats = beat_indices(count, fps, bpm, offset, times)
    pulse = np.zeros(count, np.float32)
    for b in beats:
        for k in range(max(1, int(.16*fps))):
            if b+k < count:
                pulse[b+k] = max(pulse[b+k], math.exp(-k/max(.04*fps, 1)))
    if waveform is None:
        return np.repeat(pulse[:, None], 3, axis=1), pulse, beats
    wave = np.asarray(waveform, np.float32)
    if wave.ndim > 1:
        wave = wave.reshape(-1, wave.shape[-1]).mean(axis=0)
    if sample_rate <= 0 or not np.isfinite(wave).all():
        raise ValueError('Audio requires a positive sample rate and finite samples')
    result = np.zeros((count, 3), np.float32)
    window = max(64, int(sample_rate*.06))
    freq = np.fft.rfftfreq(window, 1/sample_rate)
    ranges = [(30, 250), (250, 2500), (2500, sample_rate/2+1)]
    taper = np.hanning(window)
    for i in range(count):
        start = int(i*sample_rate/fps)
        if start >= len(wave):
            continue
        chunk = wave[start:start+window]
        if not len(chunk):
            continue
        spectrum = np.abs(np.fft.rfft(np.pad(chunk, (0, window-len(chunk)))*taper))
        for j, (lo, hi) in enumerate(ranges):
            sel = spectrum[(freq >= lo) & (freq < hi)]
            result[i, j] = np.sqrt(np.mean(sel*sel)) if len(sel) else 0
    # Do not amplify spectral leakage into a false full-strength instrument band.
    result[result < float(result.max(initial=0))*0.015] = 0
    for j in range(3):
        peak = np.percentile(result[:, j], 95)
        if peak > 1e-7:
            result[:, j] = np.clip(result[:, j]/peak, 0, 1)
    return result, pulse, beats


def composite(effect, generated, source=None, fps=24., waveform=None, sample_rate=44100,
              subject_mask=None, region_mask=None, band_map=None, amount=.8,
              bpm=120., offset=0., beat_times='', delay=.35, spread=.12,
              schedule='0:0,1:1', action_time=.5):
    if effect not in EFFECTS:
        raise ValueError('Unknown effect: '+effect)
    gen = frames(generated)
    n, h, w, _ = gen.shape
    if n > 1200 or h*w > 1920*1080:
        raise ValueError('Preview limits: 1200 frames and 1920x1080. Split long songs into shots.')
    src = gen.copy() if source is None else align(source, n, h, w)
    subject = None if subject_mask is None else mask_batch(subject_mask, n, h, w)
    region = (np.repeat(ellipse(h, w)[None], n, 0) if region_mask is None
              else mask_batch(region_mask, n, h, w))
    # Without a supplied tracked mask, silhouette effects intentionally use an ellipse.
    silhouette = subject if subject is not None else np.repeat(ellipse(h, w, ry=.44, rx=.16)[None], n, 0)
    bands, pulse, beats = reactive_bands(waveform, sample_rate, n, fps, bpm, offset, beat_times)
    amount = float(np.clip(amount, 0, 1))
    out = src.copy()
    lag = max(1, int(round(delay*fps)))
    if effect == 'world_orchestra':
        if band_map is None:
            zones = np.zeros((n, h, w, 3), np.float32)
            for k in range(3):
                zones[:, k*h//3:(k+1)*h//3, :, k] = 1
        else:
            zones = align(band_map, n, h, w)
        blend = np.clip((zones*bands[:, None, None, :]).sum(-1, keepdims=True), 0, 1)*amount
        if subject is not None:
            blend *= 1-subject
        out = src*(1-blend)+gen*blend
    elif effect == 'portal_paint':
        blend = region*(.55+.45*pulse[:, None, None, None])*amount
        if subject is not None:
            blend *= 1-subject
        out = src*(1-blend)+gen*blend
        for i in range(n):
            edge = np.clip(region[i]*(1-region[i])*5, 0, 1)
            if subject is not None:
                edge *= 1-subject[i]
            out[i] += edge*np.array([.05,.45,.8], np.float32)*pulse[i]*amount
    elif effect == 'impossible_duet':
        for i in range(n):
            k = max(0, i-lag)
            m = shift(silhouette[k], int(w*spread))*amount
            if subject is not None:
                m *= 1-subject[i]
            ghost = shift(gen[k], int(w*spread))
            out[i] = src[i]*(1-m)+ghost*m
    elif effect == 'reality_scrubber':
        try:
            points = sorted((float(a),float(b)) for a,b in (x.strip().split(':') for x in schedule.split(',')))
        except Exception as exc:
            raise ValueError('Schedule format is normalized_time:mix, e.g. 0:0,0.5:1,1:0') from exc
        if not points or not np.isfinite(points).all() or any(not 0<=a<=1 or not 0<=b<=1 for a,b in points):
            raise ValueError('Schedule times and mix values must be in [0,1]')
        if len({a for a,b in points}) != len(points):
            raise ValueError('Schedule times must be unique')
        blend = np.interp(np.linspace(0,1,n), [a for a,b in points], [b for a,b in points])[:,None,None,None]*amount
        if subject is not None:
            blend = blend*(1-subject)
        out = src*(1-blend)+gen*blend
    elif effect == 'foley_orchestra':
        # Two source banks, one marked impact; every beat aligns to that source event.
        if not beats:
            raise ValueError('No beat falls inside this clip. Check beat times or offset.')
        impact = min(n-1, max(0, int(round(action_time*fps))))
        for i in range(n):
            b = min(beats, key=lambda b: abs(i-b))
            k = min(n-1, max(0, impact+i-b))
            bank = gen if beats.index(b)%2 else src
            out[i] = bank[k]
    elif effect == 'future_echo':
        for i in range(n):
            for echo in range(4, 0, -1):
                k = i-echo*lag
                if k < 0:
                    continue
                dx = int(w*spread*echo)
                m = shift(silhouette[k], dx)*amount*(.8**echo)
                if subject is not None:
                    m *= 1-subject[i]
                color = np.roll(shift(gen[k], dx), echo%3, axis=-1)
                out[i] = out[i]*(1-m)+color*m
    elif effect == 'motion_becomes_matter':
        trail = np.zeros((h,w,1), np.float32)
        for i in range(n):
            if subject is not None:
                weight = silhouette[i,...,0]
            elif i:
                weight = np.abs(src[i]-src[i-1]).mean(-1)
                weight = np.maximum(weight-.025, 0)
            else:
                weight = np.zeros((h,w), np.float32)
            total = float(weight.sum())
            trail *= .965
            if total > 1e-5:
                yy, xx = np.mgrid[0:h,0:w]
                cx = float((xx*weight).sum()/total)/max(w-1,1)
                cy = float((yy*weight).sum()/total)/max(h-1,1)
                trail = np.maximum(trail, ellipse(h,w,cx,cy,.055,.055))
            m = trail*amount
            if subject is not None:
                m = m*(1-subject[i])
            out[i] = src[i]*(1-m)+gen[i]*m
    return np.clip(out,0,1).astype(np.float32)


def audit(images, fps):
    x = frames(images)
    changes = np.abs(x[1:]-x[:-1]).mean((1,2,3)) if len(x)>1 else np.array([], np.float32)
    return {'frames':len(x), 'fps':float(fps), 'duration_seconds':len(x)/fps,
            'mean_frame_change':float(changes.mean()) if len(changes) else 0.,
            'near_static_pair_fraction':float((changes<.0005).mean()) if len(changes) else 0.,
            'large_change_frames':(np.where(changes>.22)[0]+1).tolist(),
            'clipped_channel_fraction':float(((x<=.001)|(x>=.999)).mean()),
            'interpretation':'Diagnostics only. Cuts, darkness, animation and intentional holds can trigger flags. No semantic, identity, lip-sync or aesthetic assessment.'}
