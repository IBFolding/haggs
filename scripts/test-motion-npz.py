import os, subprocess, tempfile, unittest, zipfile
import numpy as np
SCRIPT='scripts/validate-motion-npz.py'
class TestMotion(unittest.TestCase):
 def run_validator(self,path):return subprocess.run(['python3',SCRIPT,path],capture_output=True,timeout=10).returncode
 def test_valid_and_invalid_archives(self):
  with tempfile.TemporaryDirectory() as d:
   p=os.path.join(d,'motion.npz');a=np.zeros((3,22,3),dtype=np.float32);a[:,0,1]=1
   np.savez_compressed(p,keypoints3d=a);self.assertEqual(self.run_validator(p),0)
   np.savez_compressed(p,keypoints3d=np.array([{'bad':1}],dtype=object));self.assertNotEqual(self.run_validator(p),0)
   np.savez_compressed(p,keypoints3d=np.zeros((3,3,3),dtype=np.float32));self.assertNotEqual(self.run_validator(p),0)
   with zipfile.ZipFile(p,'w') as z:z.writestr('../keypoints3d.npy',b'bad')
   self.assertNotEqual(self.run_validator(p),0)
   with zipfile.ZipFile(p,'w',compression=zipfile.ZIP_DEFLATED) as z:z.writestr('keypoints3d.npy',b'0'*32_000_001)
   self.assertNotEqual(self.run_validator(p),0)
if __name__=='__main__':unittest.main()
