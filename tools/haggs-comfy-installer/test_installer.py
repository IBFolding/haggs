import importlib.util
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ZIP = REPO / 'public/workflows/haggs-local-node-installer.zip'


class InstallerTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        with zipfile.ZipFile(ZIP) as archive:
            archive.extractall(root)
        self.bundle = root / 'Haggs-Comfy-Nodes'
        self.target = root / 'custom_nodes'
        self.target.mkdir()
        spec = importlib.util.spec_from_file_location('haggs_installer', self.bundle / 'install.py')
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)

    def test_check_install_and_existing_nodes_are_preserved(self):
        self.assertIn('No files changed', self.module.install(self.bundle, self.target))
        self.assertEqual(list(self.target.iterdir()), [])
        self.assertIn('Restart ComfyUI', self.module.install(self.bundle, self.target, True))
        for name in self.module.PACKS:
            self.assertTrue((self.target / name / '__init__.py').is_file())
        sentinel = self.target / self.module.PACKS[0] / 'user-file.txt'
        sentinel.write_text('keep')
        with self.assertRaisesRegex(ValueError, 'already exist'):
            self.module.install(self.bundle, self.target, True)
        self.assertEqual(sentinel.read_text(), 'keep')

    def test_corrupt_bundle_and_wrong_target_fail_before_copy(self):
        source = self.bundle / 'nodes' / self.module.PACKS[0] / '__init__.py'
        source.write_bytes(source.read_bytes() + b'changed')
        with self.assertRaisesRegex(ValueError, 'integrity'):
            self.module.install(self.bundle, self.target, True)
        self.assertEqual(list(self.target.iterdir()), [])

    def test_zip_is_reproducible(self):
        before = ZIP.read_bytes()
        subprocess.run([sys.executable, str(REPO / 'scripts/build-haggs-node-bundle.py')], check=True, capture_output=True)
        self.assertEqual(before, ZIP.read_bytes())


if __name__ == '__main__':
    unittest.main()
