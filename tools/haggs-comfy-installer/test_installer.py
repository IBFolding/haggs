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

    def test_resume_installs_only_missing_packs_and_preserves_existing_cache(self):
        import shutil
        first = self.module.PACKS[0]
        shutil.copytree(self.bundle / 'nodes' / first, self.target / first)
        cache = self.target / first / '__pycache__'
        cache.mkdir()
        (cache / 'test.pyc').write_bytes(b'local cache')
        message = self.module.install(self.bundle, self.target)
        self.assertIn('Already installed', message)
        self.assertIn(first, message)
        self.module.install(self.bundle, self.target, True)
        self.assertEqual((cache / 'test.pyc').read_bytes(), b'local cache')
        self.assertTrue(all((self.target / name / '__init__.py').is_file() for name in self.module.PACKS))
        self.assertIn('already installed', self.module.install(self.bundle, self.target, True))

    def test_modified_pack_blocks_all_additional_copies(self):
        import shutil
        first = self.module.PACKS[0]
        shutil.copytree(self.bundle / 'nodes' / first, self.target / first)
        (self.target / first / 'user-file.txt').write_text('keep')
        with self.assertRaisesRegex(ValueError, 'already exist'):
            self.module.install(self.bundle, self.target, True)
        self.assertEqual((self.target / first / 'user-file.txt').read_text(), 'keep')
        self.assertFalse((self.target / self.module.PACKS[1]).exists())

    def test_corrupt_bundle_and_wrong_target_fail_before_copy(self):
        source = self.bundle / 'nodes' / self.module.PACKS[0] / '__init__.py'
        source.write_bytes(source.read_bytes() + b'changed')
        with self.assertRaisesRegex(ValueError, 'integrity'):
            self.module.install(self.bundle, self.target, True)
        self.assertEqual(list(self.target.iterdir()), [])

    def test_zip_is_reproducible(self):
        # Compare payloads and metadata, not zlib's platform-dependent bytes.
        # Build in the disposable directory rather than rewriting the checked-in ZIP.
        rebuilt = Path(self.temp.name) / 'rebuilt.zip'
        again = Path(self.temp.name) / 'rebuilt-again.zip'
        builder = str(REPO / 'scripts/build-haggs-node-bundle.py')
        for target in (rebuilt, again):
            subprocess.run([sys.executable, builder, '--output', str(target)], check=True, capture_output=True)
        self.assertEqual(rebuilt.read_bytes(), again.read_bytes())
        with zipfile.ZipFile(ZIP) as checked, zipfile.ZipFile(rebuilt) as generated:
            self.assertEqual(checked.namelist(), generated.namelist())
            for name in checked.namelist():
                self.assertEqual(checked.read(name), generated.read(name), name)
                left, right = checked.getinfo(name), generated.getinfo(name)
                self.assertEqual((left.date_time, left.external_attr, left.compress_type),
                                 (right.date_time, right.external_attr, right.compress_type), name)


if __name__ == '__main__':
    unittest.main()
