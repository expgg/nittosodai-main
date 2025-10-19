import json
from flask import Flask, request
import os       # For file operations and printing command
import tempfile # For creating temporary files
import time     # For sleep
import webbrowser # NEW: To explicitly open the HTML file
import base64   # NEW: To encode the image

# WeasyPrint-related imports and checks are REMOVED as they failed the dependency check.
# HTML = None is REMOVED.

# --- CONFIGURATION (STABLE PRINTER NAME) ---
PRINTER_NAME = "RONGTA 80mm Series Printer"

# --- ESC/POS COMMANDS (Sent as raw bytes) ---
# We keep this just in case
CUT_COMMAND = b'\x1d\x56\x42\x00'

# --- RECEIPT CONFIGURATION ---
# We use HTML/CSS for layout, so fixed width text is less important, 
# but we aim for 80mm printer compatibility.
PRINTER_WIDTH_MM = 80


# --- SERVER SETUP ---
app = Flask(__name__)

# --- UTILITY FUNCTION TO FORMAT AND PRINT (REVERTED TO HTML/OPEN) ---

def format_and_print_receipt(order_data):
    """
    Formats the data into a compact HTML receipt, writes it to a temporary .html file, 
    and uses the webbrowser module to open it in the default browser for automatic printing.
    """
    
    # Helper for price formatting
    def format_price_py(price):
        return f"৳{int(round(price))}"
        
    temp_file_path = None # This will be the temporary HTML file

    try:
        # Load data
        customer = order_data['customer']
        items = order_data['items']
        total_price = order_data['totalPrice']

        # --- 1. PREPARE HEADER IMAGE ---
        header_image_html = ''
        try:
            # Read the image file, encode it in Base64, and create a data URI
            with open("ph.png", "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                header_image_html = f'<img src="data:image/png;base64,{encoded_string}" alt="Receipt Header" style="width: 100%; display: block;">'
        except FileNotFoundError:
            print("!!! WARNING: ph.png not found. Printing receipt without header image. !!!")
            # Fallback to simple text if the image isn't in the same folder as the script
            header_image_html = '<div class="center" style="font-size: 14pt; font-weight: bold; margin-bottom: 5px;">NITTO SODAI</div>'
        
        # --- 2. GENERATE THE HTML RECEIPT CONTENT ---

        # Build the item list rows
        item_rows = []
        for item in items:
            item_name = item['name']
            item_qty = f"x{item['quantity']}"
            item_total = format_price_py(item['price'] * item['quantity'])
            
            # Table row for item
            item_rows.append(f"""
                <tr>
                    <td style="width: 50%; padding-left: 2px;">{item_name}</td>
                    <td style="width: 20%; text-align: center;">{item_qty}</td>
                    <td style="width: 30%; text-align: right; padding-right: 2px;">{item_total}</td>
                </tr>
            """)
        
        # Assemble the full HTML document
        receipt_html = f"""
<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <title>Order Receipt</title>
    <style>
        /* CRITICAL: FORCES ZERO MARGINS AND REMOVES HEADER/FOOTER */
        @page {{ 
            margin: 0; 
            size: {PRINTER_WIDTH_MM}mm auto; 
        }}
        body {{ 
            width: {PRINTER_WIDTH_MM}mm; 
            margin: 0; 
            padding: 0; 
            font-family: 'monospace', sans-serif; 
            font-size: 10pt; 
            line-height: 1.3;
            color: black;
            overflow: hidden;
            padding-bottom: 20px; 
        }}
        .receipt-container {{ width: 100%; padding-top: 2px; box-sizing: border-box; }}
        .center {{ text-align: center; }}
        .separator {{ border-top: 1px solid black; height: 1px; }} /* Changed to solid */

        /* --- CUSTOMER INFO STYLES --- */
        .customer-info {{ padding: 2px 4px; }}
        .customer-info-header {{ text-align: center; font-weight: bold; margin-bottom: 2px;}} /* Reduced margin */
        .customer-info div {{ margin-bottom: 2px; }}
        .inverted-label {{
            background-color: black;
            color: white;
            padding: 1px 4px;
            margin-right: 6px;
        }}
        
        /* --- ITEM TABLE STYLES (COMPACT) --- */
        .item-table {{ width: 100%; border-collapse: collapse; padding: 0 4px; box-sizing: border-box; }}
        .item-table thead th {{
            border-bottom: 1px solid black; /* Changed to solid */
            padding-bottom: 2px;
            font-size: 9pt;
        }}
        .item-table th, .item-table td {{ 
            padding: 2px 0;
            border: none;
            text-align: left;
            vertical-align: top;
        }}
        
        /* --- TOTAL STYLES --- */
        .total-table {{ width: 100%; margin-top: 5px; padding: 0 4px; box-sizing: border-box; }}
        .total-row {{
            border-top: 2px double black;
            border-bottom: 2px double black;
        }}
        .total-row td {{ 
            padding: 4px 0;
            font-weight: bold;
            font-size: 12pt;
        }}

    </style>
</head>
<body>
    <div class="receipt-container">
        <!-- === IMAGE HEADER === -->
        {header_image_html}
        <div class="center" style="font-size: 10pt; font-weight: bold; margin: -2px 0 2px 0;">ORDER RECEIPT</div>

        <!-- === CUSTOMER INFO === -->
        <div class="separator" style="margin: 4px 0 6px 0;"></div>
        <div class="customer-info">
            <div class="customer-info-header">Customer Information</div>
            <div class="separator" style="margin-bottom: 5px;"></div>
            <div><strong class="inverted-label">Name:</strong>{customer['name']}</div>
            <div><strong class="inverted-label">Phone:</strong>{customer['phone']}</div>
            <div><strong class="inverted-label">Address:</strong>{customer['address'] or 'N/A'}</div>
        </div>
        <div class="separator" style="margin: 6px 0;"></div>

        <!-- === ITEM LIST (COMPACT) === -->
        <table class="item-table">
            <thead>
                <tr>
                    <th style="width: 50%; padding-left: 2px;">Item Name</th>
                    <th style="width: 20%; text-align: center;">Qty</th>
                    <th style="width: 30%; text-align: right; padding-right: 2px;">Total</th>
                </tr>
            </thead>
            <tbody>
                {'\n'.join(item_rows)}
            </tbody>
        </table>

        <!-- === NEW TOTAL === -->
        <table class="total-table">
             <tr class="total-row">
                <td style="text-align: right; padding-right: 10px; width: 65%;">TOTAL</td>
                <td style="text-align: right; padding-right: 2px; width: 35%;">{format_price_py(total_price)}</td>
            </tr>
        </table>

        <div class="separator" style="margin: 6px 0;"></div>

        <!-- === NEW FOOTER === -->
        <div class="center" style="padding: 5px 0; font-size: 9pt;">আপনার অর্ডার করার জন্য ধন্যবাদ</div>
        
    </div>
    
    <!-- NEW JAVASCRIPT: Auto-print and attempt to close the window -->
    <script>
        // Use a small timeout to ensure the browser has fully rendered the content before printing
        setTimeout(function() {{
            window.print();
            
            // Attempt to close the window immediately after print dialog opens
            window.close();
        }}, 500);
    </script>
</body>
</html>
"""
        
        # --- 3. WRITE TO TEMPORARY HTML FILE ---
        # We need a path for the HTML file
        temp_file_path = os.path.join(tempfile.gettempdir(), f"receipt_{time.time()}.html")
        
        # Write the HTML content
        with open(temp_file_path, mode='w', encoding='utf-8') as tmp:
            tmp.write(receipt_html)
            
        # --- 4. OPEN THE TEMPORARY HTML FILE IN DEFAULT BROWSER ---
        # The webbrowser module is more robust for opening files across systems than os.startfile()
        webbrowser.open_new(f'file://{temp_file_path}')

        # Give the browser a moment to open
        time.sleep(2) 
        
        # NOTE: Automatic printing is now handled by the JS inside the HTML.
        return True, f"Receipt opened in default browser for automatic printing. File: {temp_file_path}"

    except Exception as e:
        error_message = f"Error: {e}"
        print(f"!!! PRINTING FAILED: {error_message} !!!")
        return False, f"Printing Failed: An unexpected error occurred. Check browser status. {error_message}"

    finally:
        # --- 5. CLEANUP ---
        # We rely on the system to clean up temp files eventually since the browser needs
        # the file open. Removing the explicit os.remove call to prevent errors.
        pass


# --- FLASK ENDPOINT ---
@app.route('/print', methods=['POST'])
def handle_print_job():
    if not request.json:
        return {"status": "error", "message": "Missing JSON payload"}, 400

    order_data = request.json
    print("=" * 40)
    print(f"--- REAL PRINT JOB RECEIVED for: {order_data['customer']['name']} ---\n")
    
    success, message = format_and_print_receipt(order_data)
    
    # Log the result
    print(f"\nPrint Result: {'SUCCESS' if success else 'FAILED'}. Message: {message}")
    print("=" * 40)

    if success:
        return {"status": "success", "message": message}, 200
    else:
        return {"status": "error", "message": message}, 500


# --- RUN THE SERVER ---
if __name__ == '__main__':
    print("--- PRINTER SERVER STARTING ---")
    print(f"Targeting Printer: {PRINTER_NAME} (via browser open for manual print)")
    app.run(host='0.0.0.0', port=5000)

