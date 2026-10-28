"""Byte-level integrity checks for the official-document manifest."""

import hashlib
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "data" / "documents_manifest.json"
DOCUMENT_DIR = ROOT / "data" / "official_documents"


class DocumentManifestIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

    def test_manifest_ids_and_filenames_are_unique_and_counted(self):
        documents = self.manifest["documents"]
        self.assertEqual(self.manifest["total_documents"], len(documents))
        self.assertEqual(len({item["id"] for item in documents}), len(documents))
        self.assertEqual(len({item["filename"] for item in documents}), len(documents))

    def test_manifest_has_exact_file_coverage(self):
        declared = {item["filename"] for item in self.manifest["documents"]}
        present = {path.name for path in DOCUMENT_DIR.iterdir() if path.is_file()}
        self.assertEqual(declared, present)

    def test_every_document_size_and_sha256_matches_bytes(self):
        for item in self.manifest["documents"]:
            with self.subTest(document=item["id"]):
                path = DOCUMENT_DIR / item["filename"]
                content = path.read_bytes()
                self.assertEqual(len(content), item["file_size_bytes"])
                self.assertEqual(hashlib.sha256(content).hexdigest(), item["sha256"])

    def test_up_policy_notification_and_guidelines_are_separate_records(self):
        documents = {item["id"]: item for item in self.manifest["documents"]}
        notification = documents["up_dc_policy_2026_notification"]
        guidelines = documents["up_dc_policy_2026_guidelines"]
        self.assertNotEqual(notification["filename"], guidelines["filename"])
        self.assertNotEqual(notification["sha256"], guidelines["sha256"])


if __name__ == "__main__":
    unittest.main()
