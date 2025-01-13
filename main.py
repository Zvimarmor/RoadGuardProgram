import re
import json
from datetime import datetime
from collections import defaultdict

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
                        "time": time,
                        "reporter": reporter,
                        "direction": direction,
                        "car": car_desc
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
                                "reporter": reporter,
                                "direction": direction,
                                "car": car_desc
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

# Usage example:
if __name__ == "__main__":
    program = RoadGuardProgram()

    # Input chat file and date
    chat_file = "whatsapp_chat.txt"  # Replace with your file
    date = "10.6.2024"  # Replace with the desired date

    # Process the chat file for the given date
    chronological, car_summary = program.process_chat(chat_file, date)

    # Print tables
    program.print_tables(chronological, car_summary)
