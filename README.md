# RoadGuardProgram

A Python program for parsing and summarizing car observation reports from WhatsApp chat logs. It processes messages, generates tables, and saves results in JSON and PDF formats.

## Features
- Extracts observation data from WhatsApp chat logs.
- Generates chronological and car-specific summaries.
- Saves data in JSON and creates PDF reports.
- Handles unrecognized messages with interactive correction.

## Usage
1. Place the WhatsApp chat file in the project directory.
2. Run the program and provide the file name and date:
   ```bash
   python road_guard_program.py
   ```
3. Outputs:
   - JSON data saved as `road_data.json`.
   - PDF report saved as `road_guard_report.pdf`.

## Installation
Install dependencies:
```bash
pip install fpdf
```

## File Requirements
- `FreeSans.ttf`: Unicode font required for PDF generation.
- `road_data.json`: Auto-created for storing parsed data.

## Example
Input: A WhatsApp chat log (`whatsapp_chat.txt`)  
Output: Organized tables in JSON and PDF formats.

**Note**: Ensure the font file `FreeSans.ttf` is in the project folder.
```# RoadGuardProgram