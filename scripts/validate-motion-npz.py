#!/usr/bin/env python3
"""Local test validator only; production requires a separately isolated, resource-limited worker."""
import os, sys, zipfile
if os.environ.get('NODE_ENV') == 'production': raise SystemExit('unavailable')
if len(sys.argv)!=2: raise SystemExit('invalid request')
p=sys.argv[1]
if not os.path.isfile(p) or os.path.getsize(p)>10_000_000: raise SystemExit('invalid size')
try:
 with zipfile.ZipFile(p) as z:
  entries=z.infolist();allowed={'keypoints3d.npy','rot6d.npy','transl.npy','root_rotations_mat.npy'}
  if not entries or len(entries)>4 or len({e.filename for e in entries})!=len(entries) or any(e.filename not in allowed or e.is_dir() or e.flag_bits&1 or e.file_size>32_000_000 for e in entries) or sum(e.file_size for e in entries)>40_000_000 or 'keypoints3d.npy' not in {e.filename for e in entries}:raise ValueError('archive limits')
 import numpy as np
 with np.load(p,allow_pickle=False) as data:
  for key in data.files:
   a=data[key]
   if a.dtype.kind!='f' or a.dtype.itemsize not in (4,8) or a.size>8_000_000 or not np.isfinite(a).all():raise ValueError('invalid array')
  a=data['keypoints3d']
  if a.ndim==3:a=a[None]
  if a.ndim!=4 or not 1<=a.shape[0]<=4 or not 2<=a.shape[1]<=600 or not 22<=a.shape[2]<=256 or a.shape[3]!=3 or np.ptp(a[:,:,:22,1])<.05:raise ValueError('invalid motion shape')
except Exception:raise SystemExit('invalid NPZ')
print('valid')
