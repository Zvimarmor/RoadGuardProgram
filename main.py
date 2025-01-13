import re
import json
from datetime import datetime
from collections import defaultdict
from fpdf import FPDF

class RoadGuardProgram:
    def __init__(self, save_file="road_data.json"):
        self.save_file = save_file
        self.data = self.load_data()

    def load_data(self):
        # Load existing data from the save file
        try:
            with open(self.save_file, "r") as file:
                return json.load(file)
        except FileNotFoundError:
            return {}

    def save_data(self):
        # Save all data into the save file
        with open(self.save_file, "w") as file:
            json.dump(self.data, file, ensure_ascii=False, indent=4)

    def parse_messages(self, chat_file, date):
        with open(chat_file, "r", encoding="utf-8") as file:
            lines = file.readlines()

        messages = []
        pattern = r"\[(\d+\.\d+\.\d+), (\d+:\d+:\d+)\] (.+?): דיווח: (\S+) (.+)"

        for line in lines:
            match = re.match(pattern, line.strip())
            if match:
                msg_date, time, reporter, direction, car_desc = match.groups()
                if msg_date == date:
                    messages.append({
                        "date": msg_date,
                        "time": time[:5],
                        "reporter": reporter[::-1],
                        "direction": direction[::-1],
                        "car": car_desc[::-1]
                    })
            else:
                # If the message doesn't match, ask for correction
                print(f"Message not recognized: {line.strip()}")
                corrected_line = input("Please provide the corrected message (or press Enter to skip): ").strip()
                if corrected_line:
                    corrected_match = re.match(pattern, corrected_line)
                    if corrected_match:
                        msg_date, time, reporter, direction, car_desc = corrected_match.groups()
                        if msg_date == date:
                            messages.append({
                                "date": msg_date,
                                "time": time,
                                "reporter": reporter[::-1],
                                "direction": direction[::-1],
                                "car": car_desc[::-1]
                            })
                    else:
                        print("Correction still does not match the expected format. Skipping...")
        return messages

    def generate_tables(self, messages):
        # Chronological table
        chronological = sorted(messages, key=lambda x: x["time"])

        # Car summary table
        car_summary = defaultdict(list)
        for msg in messages:
            car_summary[msg["car"]].append({
                "time": msg["time"],
                "reporter": msg["reporter"],
                "direction": msg["direction"]
            })

        return chronological, car_summary

    def process_chat(self, chat_file, date):
        # Parse messages
        messages = self.parse_messages(chat_file, date)

        # Generate tables
        chronological, car_summary = self.generate_tables(messages)

        # Add data to the persistent record
        if date not in self.data:
            self.data[date] = {"chronological": [], "car_summary": {}}

        self.data[date]["chronological"].extend(chronological)
        for car, details in car_summary.items():
            if car not in self.data[date]["car_summary"]:
                self.data[date]["car_summary"][car] = []
            self.data[date]["car_summary"][car].extend(details)

        # Save data
        self.save_data()

        return chronological, car_summary

    def print_tables(self, chronological, car_summary):
        print("=== Chronological Table ===")
        for entry in chronological:
            print(f"{entry['time']} | {entry['reporter']} | {entry['direction']} | {entry['car']}")

        print("\n=== Car Summary Table ===")
        for car, details in car_summary.items():
            print(f"{car}:")
            for detail in details:
                print(f"  - {detail['time']} | {detail['reporter']} | {detail['direction']}")

    def save_output_to_pdf(self, file_name, chronological, car_summary, date):
        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=5)
        pdf.add_page()

        # Use a Unicode-compatible font
        pdf.add_font("FreeSans", "", "FreeSans.ttf", uni=True)
        pdf.set_font("FreeSans", size=12)

        # Add Title
        pdf.set_font("FreeSans", size=8)
        label = "דיווח תצפית מכוניות יומית"
        pdf.cell(200, 10, txt=label[::-1], ln=True, align="C")
        pdf.cell(200,7,txt = date, ln = True, align = "C")

        # Add Chronological Table
        pdf.set_font("FreeSans", size=8 )
        pdf.ln(10)
        for entry in chronological:
            line = f"{entry['time']} | {entry['reporter']} | {entry['direction']} | {entry['car']}"
            pdf.cell(200, 5, txt=line, ln=True)

        # Add Car Summary Table
        pdf.ln(5)
        label = "תצפית לפי מכונית"
        pdf.cell(200, 5, txt=label[::-1], ln=True, align="L")
        for car, details in car_summary.items():
            pdf.cell(200, 5, txt=f"{car}:", ln=True)
            for detail in details:
                line = f"  - {detail['time']} | {detail['reporter']} | {detail['direction']}"
                pdf.cell(200, 5, txt=line, ln=True)

        # Save to file
        pdf.output(file_name)
        print(f"PDF saved as: {file_name}")


# Usage example:
if __name__ == "__main__":
    program = RoadGuardProgram()

    # Input chat file and date
    chat_file = "whatsapp_chat.txt"  # Replace with your file
    date = "11.6.2024"  # Replace with the desired date

    # Process the chat file for the given date
    chronological, car_summary = program.process_chat(chat_file, date)

    # Print tables and save to PDF
    program.print_tables(chronological, car_summary)
    program.save_output_to_pdf("road_guard_report.pdf", chronological, car_summary,date)
