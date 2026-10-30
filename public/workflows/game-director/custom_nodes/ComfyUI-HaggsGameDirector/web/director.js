import { app } from '../../scripts/app.js';

app.registerExtension({
  name: 'Haggs.GameDirector',
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name === 'HaggsActionGuide') {
      const previous = nodeType.prototype.onNodeCreated;
      nodeType.prototype.onNodeCreated = function () {
        previous?.apply(this, arguments);
        const node = this;
        const box = document.createElement('div');
        box.style.cssText = 'padding:8px;background:#101723;color:#dce9f6;font:12px system-ui';
        const label = document.createElement('div');
        label.textContent = 'Draw actor 1’s root path. Left → right is screen position; the stroke spans the shot.';
        const canvas = document.createElement('canvas');
        canvas.width = 440; canvas.height = 250;
        canvas.style.cssText = 'width:100%;height:250px;touch-action:none;cursor:crosshair';
        const ctx = canvas.getContext('2d');
        const reset = document.createElement('button');
        reset.textContent = 'Reset actor 1 path';
        box.append(label, canvas, reset);
        const find = name => node.widgets?.find(w => w.name === name);
        let stroke = null;
        const read = () => JSON.parse(find('timeline_json')?.value || '{}');
        const paint = points => {
          ctx.fillStyle = '#101723'; ctx.fillRect(0, 0, 440, 250);
          ctx.strokeStyle = '#243347'; ctx.lineWidth = 1;
          for (let x = 0; x <= 440; x += 44) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 250); ctx.stroke(); }
          for (let y = 0; y <= 250; y += 25) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(440, y); ctx.stroke(); }
          if (!points?.length) return;
          ctx.strokeStyle = '#9df5c7'; ctx.lineWidth = 3; ctx.beginPath();
          points.forEach(([x, y], i) => i ? ctx.lineTo(x * 440, y * 250) : ctx.moveTo(x * 440, y * 250)); ctx.stroke();
          points.forEach(([x, y], i) => { ctx.fillStyle = i === 0 ? '#fff' : '#f8b46c'; ctx.beginPath(); ctx.arc(x * 440, y * 250, 4, 0, Math.PI * 2); ctx.fill(); });
        };
        const refresh = () => { try { paint(read().actors?.[0]?.path?.map(p => [p[1], p[2]])); } catch { paint([]); } };
        const write = points => {
          try {
            const data = read();
            if (!Array.isArray(data.actors) || !data.actors.length) data.actors = [{ name: 'hero', events: [] }];
            const duration = Math.max(0.1, (Number(find('frame_count')?.value || 124) - 1) / 24);
            data.actors[0].path = points.map(([x, y], i) => [Number((duration * i / Math.max(1, points.length - 1)).toFixed(4)), Number(x.toFixed(4)), Number(y.toFixed(4))]);
            const widget = find('timeline_json'); widget.value = JSON.stringify(data, null, 2); widget.callback?.(widget.value);
            app.graph.setDirtyCanvas(true, true); refresh();
          } catch { label.textContent = 'Fix invalid timeline JSON before drawing a path.'; }
        };
        const point = e => { const r = canvas.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
        canvas.onpointerdown = e => { stroke = [point(e)]; canvas.setPointerCapture(e.pointerId); paint(stroke); };
        canvas.onpointermove = e => { if (stroke) { stroke.push(point(e)); paint(stroke); } };
        canvas.onpointerup = e => {
          if (!stroke) return;
          stroke.push(point(e));
          const step = Math.max(1, Math.ceil(stroke.length / 40));
          const sampled = stroke.filter((_, i) => i % step === 0); sampled.push(stroke[stroke.length - 1]);
          write(sampled); stroke = null;
        };
        canvas.onpointercancel = () => { stroke = null; refresh(); };
        reset.onclick = () => write([[0.5, 0.55]]);
        const widget = this.addDOMWidget('haggs_path_editor', 'haggs_path_editor', box, { serialize: false });
        widget.computeSize = () => [440, 315];
        requestAnimationFrame(refresh);
        const configured = this.onConfigure;
        this.onConfigure = function () { configured?.apply(this, arguments); requestAnimationFrame(refresh); };
      };
    }
    if (nodeData.name === 'HaggsBranchPlayer') {
      const previous = nodeType.prototype.onExecuted;
      nodeType.prototype.onExecuted = function (message) {
        previous?.apply(this, arguments);
        const url = message?.player_url?.[0];
        if (!/^\/haggs-game-director\/[0-9a-f]{32}\/player\.html$/.test(url || '')) return;
        if (!this.haggsPlayerFrame) {
          const frame = document.createElement('iframe');
          frame.setAttribute('sandbox', 'allow-scripts');
          frame.title = 'Haggs prepared branching scene';
          frame.style.cssText = 'width:100%;height:440px;border:0;background:#10131b';
          this.haggsPlayerFrame = frame;
          const widget = this.addDOMWidget('haggs_branch_player', 'haggs_branch_player', frame, { serialize: false });
          widget.computeSize = () => [560, 450];
          this.setSize([Math.max(this.size[0], 580), Math.max(this.size[1], 680)]);
        }
        this.haggsPlayerFrame.src = url;
      };
    }
  },
});
