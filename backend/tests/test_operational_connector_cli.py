import io
import os
import unittest
from contextlib import redirect_stderr
from unittest.mock import patch

from backend.app.jobs.run_operational_connector import main


class OperationalConnectorCliTests(unittest.TestCase):
    def run_without_environment(self, source, extra_environment=None):
        stream = io.StringIO()
        with patch.dict(os.environ, extra_environment or {}, clear=True), redirect_stderr(stream):
            code = main(["--source", source, "--check"])
        return code, stream.getvalue()

    def test_cpcb_missing_configuration_is_concise_and_safe(self):
        code, message = self.run_without_environment("cpcb")
        self.assertEqual(code, 2)
        self.assertIn("Configuration error:", message)
        self.assertIn("missing", message)
        self.assertNotIn("Traceback", message)
        self.assertNotIn("api-key", message.casefold())

    def test_imd_and_nwdp_disabled_sources_return_two_without_traceback(self):
        cases = (("imd", {"ECOSITE_IMD_ENDPOINT": "https://configured.example"}),
                 ("nwdp", {"ECOSITE_NWDP_ENDPOINT": "https://configured.example"}))
        for source, environment in cases:
            with self.subTest(source=source):
                code, message = self.run_without_environment(source, environment)
                self.assertEqual(code, 2)
                self.assertIn("NOT_CONNECTED", message)
                self.assertIn("response contract is not verified", message)
                self.assertNotIn("Traceback", message)


if __name__ == "__main__": unittest.main()
