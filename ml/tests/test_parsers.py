"""Tests for PDF, DOCX, and unified document parsers."""

from pathlib import Path
import unittest

from ml.data.synthetic.generator import create_minimal_docx_bytes, create_minimal_pdf_bytes
from ml.parsers.docx_parser import DOCXParser
from ml.parsers.pdf_parser import PDFParser
from ml.parsers.unified_parser import DocumentParser


class TestParsers(unittest.TestCase):
    """Test parser functionality across supported document formats."""

    def test_pdf_parser_single_page(self):
        pages_text = ["First page text with details\nSubstation load: 45 MW"]
        pdf_bytes = create_minimal_pdf_bytes(pages_text)
        doc = PDFParser.parse_bytes(pdf_bytes, filename="sample.pdf")
        self.assertEqual(doc.page_count, 1)
        self.assertIn("First page text with details", doc.raw_text)
        self.assertIn("Substation load: 45 MW", doc.raw_text)

    def test_pdf_parser_multi_page(self):
        pages_text = [
            "Chapter 1: Executive Summary",
            "Chapter 2: Power Requirements 80 MW",
            "Chapter 3: Water Balance 2000 KLD"
        ]
        pdf_bytes = create_minimal_pdf_bytes(pages_text)
        doc = PDFParser.parse_bytes(pdf_bytes, filename="multipage.pdf")
        self.assertEqual(doc.page_count, 3)
        self.assertEqual(doc.pages[0].page_number, 1)
        self.assertIn("Chapter 1: Executive Summary", doc.pages[0].text)
        self.assertEqual(doc.pages[1].page_number, 2)
        self.assertIn("Chapter 2: Power Requirements", doc.pages[1].text)
        self.assertEqual(doc.pages[2].page_number, 3)
        self.assertIn("Chapter 3: Water Balance", doc.pages[2].text)

    def test_docx_parser_paragraphs_and_tables(self):
        paragraphs = [
            "MIDC Bulk Water Allocation Order",
            "Permitted Water Allocation: 1800 KLD"
        ]
        tables = [
            [
                ["Parameter", "Permitted Quantity", "Unit"],
                ["Raw Water", "1800", "KLD"],
                ["Recycled Supply", "800", "KLD"]
            ]
        ]
        docx_bytes = create_minimal_docx_bytes(paragraphs, tables_data=tables)
        doc = DOCXParser.parse_bytes(docx_bytes, filename="test.docx")
        self.assertEqual(doc.page_count, 1)
        self.assertIn("MIDC Bulk Water Allocation Order", doc.raw_text)
        self.assertIn("Permitted Water Allocation: 1800 KLD", doc.raw_text)
        self.assertIn("Raw Water | 1800 | KLD", doc.raw_text)
        self.assertEqual(len(doc.pages[0].tables), 1)

    def test_docx_parser_page_breaks(self):
        paragraphs = [
            "Page 1 Content",
            "--- PAGE BREAK ---",
            "Page 2 Content"
        ]
        docx_bytes = create_minimal_docx_bytes(paragraphs)
        doc = DOCXParser.parse_bytes(docx_bytes, filename="paged.docx")
        self.assertEqual(doc.page_count, 2)
        self.assertEqual(doc.pages[0].page_number, 1)
        self.assertIn("Page 1 Content", doc.pages[0].text)
        self.assertEqual(doc.pages[1].page_number, 2)
        self.assertIn("Page 2 Content", doc.pages[1].text)

    def test_unified_parser_auto_dispatch(self):
        fixtures_dir = Path(__file__).resolve().parent.parent / "data" / "synthetic" / "fixtures"
        pdf_file = fixtures_dir / "TSSPDCL_Grid_Sanction_FabCity_Phase1.pdf"
        txt_file = fixtures_dir / "TSSPDCL_Grid_Sanction_FabCity_Phase1.txt"

        if pdf_file.exists():
            doc_pdf = DocumentParser.parse_file(pdf_file)
            self.assertEqual(doc_pdf.file_format, "PDF")
            self.assertIn("TSSPDCL", doc_pdf.raw_text)

        if txt_file.exists():
            doc_txt = DocumentParser.parse_file(txt_file)
            self.assertEqual(doc_txt.file_format, "TXT")
            self.assertIn("TSSPDCL", doc_txt.raw_text)

    def test_corrupt_pdf_bytes_handling(self):
        corrupt_bytes = b"%PDF-1.4\ncorrupted random payload %%EOF without trailer"
        doc = PDFParser.parse_bytes(corrupt_bytes, filename="corrupt.pdf")
        self.assertEqual(doc.page_count, 1)
        self.assertIsInstance(doc.raw_text, str)

    def test_corrupt_docx_bytes_handling(self):
        corrupt_bytes = b"PK\x03\x04\x14\x00corrupt-zip-headers-not-valid-openxml"
        doc = DOCXParser.parse_bytes(corrupt_bytes, filename="corrupt.docx")
        self.assertEqual(doc.page_count, 1)
        self.assertTrue(doc.metadata.get("corrupted", False))

    def test_empty_bytes_handling(self):
        doc_pdf = PDFParser.parse_bytes(b"", filename="empty.pdf")
        self.assertEqual(doc_pdf.page_count, 1)
        doc_docx = DOCXParser.parse_bytes(b"", filename="empty.docx")
        self.assertEqual(doc_docx.page_count, 1)
        self.assertTrue(doc_docx.metadata.get("corrupted", False))


if __name__ == "__main__":
    unittest.main()
