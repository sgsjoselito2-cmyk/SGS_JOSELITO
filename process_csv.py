import csv
import requests
import io
import sys

def download_and_process_csv(url, target_columns, output_file):
    """
    Downloads a CSV from a URL, extracts specific columns, and saves to a new file.
    
    Args:
        url (str): The URL of the CSV file.
        target_columns (list): List of column names to extract.
        output_file (str): Path to the output CSV file.
    """
    try:
        print(f"Downloading CSV from: {url}")
        # Setting a timeout for the request
        response = requests.get(url, timeout=30)
        response.raise_for_status() # Check for HTTP errors
        
        # Use StringIO to treat the string content as a file
        # We use response.content.decode('utf-8') to handle encoding properly
        csv_data = io.StringIO(response.content.decode('utf-8'))
        reader = csv.DictReader(csv_data)
        
        # Check if target columns exist in the header
        if not reader.fieldnames:
            print("Error: CSV file has no header or is empty.")
            return

        # Validate that all requested columns exist
        missing_cols = [col for col in target_columns if col not in reader.fieldnames]
        if missing_cols:
            print(f"Error: Missing columns in CSV: {', '.join(missing_cols)}")
            print(f"Available columns: {', '.join(reader.fieldnames)}")
            return

        print(f"Extracting columns: {', '.join(target_columns)}")
        
        count = 0
        # Write to new CSV directly to be memory efficient for large files
        with open(output_file, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=target_columns)
            writer.writeheader()
            
            for row in reader:
                extracted_row = {col: row[col] for col in target_columns}
                writer.writerow(extracted_row)
                count += 1
            
        print(f"Successfully saved extracted data to {output_file}")
        print(f"Processed {count} rows.")

    except requests.exceptions.RequestException as e:
        print(f"Network error downloading CSV: {e}")
    except UnicodeDecodeError:
        print("Error: Could not decode CSV content. Ensure it is UTF-8 encoded.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python process_csv.py <url> <output_file> <column_name1> [column_name2] ...")
        print("\nExample:")
        print("python process_csv.py https://example.com/data.csv filtered_data.csv Name Email")
    else:
        url_arg = sys.argv[1]
        output_arg = sys.argv[2]
        cols_arg = sys.argv[3:]
        download_and_process_csv(url_arg, cols_arg, output_arg)
