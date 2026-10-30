"""Haggs Contest Lab: seven effects, a paid-prompt gate, and take diagnostics."""
import json
import uuid
from fractions import Fraction
from pathlib import Path
import numpy as np
import torch
import folder_paths
from comfy_api.latest import InputImpl, Types
from .effects import composite, align, audit


class _Effect:
    EFFECT = ''
    RETURN_TYPES = ('VIDEO',)
    RETURN_NAMES = ('finished_video',)
    FUNCTION = 'render'
    CATEGORY = 'Haggs/Contest Lab'

    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {
            'generated_video': ('VIDEO',),
            'amount': ('FLOAT', {'default': .8, 'min': 0., 'max': 1., 'step': .01}),
            'bpm': ('FLOAT', {'default': 120., 'min': 20., 'max': 300.}),
            'beat_offset_seconds': ('FLOAT', {'default': 0., 'min': 0., 'max': 600.}),
            'beat_times_seconds': ('STRING', {'default': '', 'multiline': True}),
            'delay_seconds': ('FLOAT', {'default': .35, 'min': .01, 'max': 10.}),
            'spread_fraction': ('FLOAT', {'default': .12, 'min': -.5, 'max': .5, 'step': .01}),
            'reality_schedule': ('STRING', {'default': '0:0,0.5:1,1:0'}),
            'source_impact_seconds': ('FLOAT', {'default': .5, 'min': 0., 'max': 600.}),
        }, 'optional': {
            'source_video': ('VIDEO',),
            'music': ('AUDIO',),
            'subject_mask': ('MASK',),
            'region_mask': ('MASK',),
            'band_map': ('IMAGE',),
        }}

    def render(self, generated_video, amount=.8, bpm=120., beat_offset_seconds=0.,
               beat_times_seconds='', delay_seconds=.35, spread_fraction=.12,
               reality_schedule='0:0,0.5:1,1:0', source_impact_seconds=.5,
               source_video=None, music=None, subject_mask=None, region_mask=None,
               band_map=None):
        c = generated_video.get_components()
        fps = float(c.frame_rate)
        generated = c.images.detach().cpu().numpy()
        n,h,w,_ = generated.shape
        if n>1200 or h*w>1920*1080:
            raise ValueError('Contest Lab is a short-shot compositor: maximum 1200 frames and 1080p. Use a 5-second 768p preview first.')
        source = None
        source_audio = None
        if source_video is not None:
            s = source_video.get_components()
            source = align(s.images.detach().cpu().numpy(), n,h,w,float(s.frame_rate),fps)
            source_audio = s.audio
        audio = music if music is not None else source_audio if source_audio is not None else c.audio
        waveform = None if audio is None else audio['waveform'].detach().cpu().numpy()
        sr = 44100 if audio is None else int(audio['sample_rate'])
        to_numpy = lambda x: None if x is None else x.detach().cpu().numpy()
        result = composite(self.EFFECT, generated, source=source, fps=fps,
                           waveform=waveform, sample_rate=sr, subject_mask=to_numpy(subject_mask),
                           region_mask=to_numpy(region_mask), band_map=to_numpy(band_map),
                           amount=amount, bpm=bpm, offset=beat_offset_seconds,
                           beat_times=beat_times_seconds, delay=delay_seconds,
                           spread=spread_fraction, schedule=reality_schedule,
                           action_time=source_impact_seconds)
        # Keep the original waveform (no generative audio replacement). Match shot duration.
        if audio is not None:
            samples = round(len(result)/fps*sr)
            wave = audio['waveform'].detach().cpu()[..., :samples]
            if wave.shape[-1] < samples:
                wave = torch.nn.functional.pad(wave, (0, samples-wave.shape[-1]))
            audio = {'waveform':wave, 'sample_rate':sr}
        return (InputImpl.VideoFromComponents(Types.VideoComponents(
            images=torch.from_numpy(result), audio=audio,
            frame_rate=Fraction(str(fps)).limit_denominator(100000))),)


class HaggsH3PromptGate:
    RETURN_TYPES = ('STRING',)
    RETURN_NAMES = ('shot_contract',)
    FUNCTION = 'build'
    CATEGORY = 'Haggs/Contest Lab'

    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {
            'enable_paid_generation': ('BOOLEAN', {'default': False}),
            'scene': ('STRING', {'default': 'A single cinematic shot.', 'multiline': True}),
            'continuity': ('STRING', {'default': 'Preserve reference subject, wardrobe, lighting and screen direction.', 'multiline': True}),
            'camera': ('STRING', {'default': 'Locked camera, constant focal length; no cuts.'}),
            'action': ('STRING', {'default': 'One clear continuous action with a brief settle at the end.', 'multiline': True}),
        }}

    def build(self, enable_paid_generation, scene, continuity, camera, action):
        if not enable_paid_generation:
            raise ValueError('Paid H3 generation is OFF. Review the connected H3 model settings and current Comfy price, then explicitly enable this switch to submit one take. No job was submitted by this prompt gate.')
        return (f'SCENE\n{scene}\n\nCONTINUITY\n{continuity}\n\nCAMERA\n{camera}\n\nACTION\n{action}\n\nSingle shot; no titles or added logos. Keep clean silhouettes and readable movement for compositing.',)


class HaggsTakeAudit:
    RETURN_TYPES = ('VIDEO','STRING')
    RETURN_NAMES = ('video','diagnostic_report')
    FUNCTION = 'check'
    CATEGORY = 'Haggs/Contest Lab'
    OUTPUT_NODE = True

    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'video': ('VIDEO',)}}

    def check(self, video):
        c = video.get_components()
        report = audit(c.images.detach().cpu().numpy(), float(c.frame_rate))
        text = json.dumps(report, indent=2)
        directory = Path(folder_paths.get_output_directory())/'haggs-reports'
        directory.mkdir(parents=True, exist_ok=True)
        target = directory/(uuid.uuid4().hex+'.json')
        target.write_text(text)
        return {'ui': {'text': [text]}, 'result': (video, text)}


_names = {
    'HaggsWorldOrchestra': ('world_orchestra','World Orchestra'),
    'HaggsImpossibleDuet': ('impossible_duet','Impossible Duet'),
    'HaggsPortalPaint': ('portal_paint','Portal Paint'),
    'HaggsRealityScrubber': ('reality_scrubber','Reality Scrubber'),
    'HaggsFoleyOrchestra': ('foley_orchestra','Foley Orchestra'),
    'HaggsFutureEcho': ('future_echo','Future Echo'),
    'HaggsMotionBecomesMatter': ('motion_becomes_matter','Motion Becomes Matter'),
}
NODE_CLASS_MAPPINGS = {key: type(key, (_Effect,), {'EFFECT':value[0]}) for key,value in _names.items()}
NODE_CLASS_MAPPINGS.update(HaggsH3PromptGate=HaggsH3PromptGate, HaggsTakeAudit=HaggsTakeAudit)
NODE_DISPLAY_NAME_MAPPINGS = {key:'Haggs · '+value[1] for key,value in _names.items()}
NODE_DISPLAY_NAME_MAPPINGS.update(HaggsH3PromptGate='Haggs · H3 Shot Contract & Paid Switch', HaggsTakeAudit='Haggs · Take Diagnostics')
