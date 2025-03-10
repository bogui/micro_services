import json
import sys
import os
from playwright.sync_api import sync_playwright, ViewportSize
from datetime import datetime

def generate_pdf(data):
    # Parse input data
    job_data = json.loads(data)
    
    with sync_playwright() as p:
        # Launch browser with specific viewport
        browser = p.chromium.launch(
            args=['--font-render-hinting=none']  # Improved font rendering
        )
        
        # Create context with viewport size matching A4 dimensions at 96 DPI
        context = browser.new_context(
            viewport=ViewportSize(width=794, height=1123)  # A4 dimensions at 96 DPI
        )
        
        # Create new page
        page = context.new_page()
        
        # Set content and wait for any network requests to complete
        page.set_content(job_data['htmlContent'], wait_until='networkidle')
        
        # Configure PDF options
        pdf_options = {
            'format': 'A4',
            'margin': {
                'top': '20mm',
                'right': '0mm',
                'bottom': '0mm',
                'left': '0mm'
            },
            'print_background': True,
            'prefer_css_page_size': True,
            'display_header_footer': True,
            'header_template': '''
                <div style="color: #000; text-align: right; font-size: 10px; margin: 10px 0 0 40px; font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                    Страница <span class="pageNumber"></span> от <span class="totalPages"></span>
                </div>
            ''',
            'footer_template': f'''
                <div style="color: #000; font-size: 10px; margin: 10px 0 0 40px; font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                    Генерирано от <a href="{job_data.get('frontendUrl')}">{job_data.get('appName')}</a> - {job_data.get('frontendUrl')}. Разпечатано на {datetime.now().strftime('%d.%m.%Y')}
                </div>
            '''
        }
        
        try:
            # Ensure the output directory exists
            output_path = job_data['filePath']
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # Generate PDF
            pdf_bytes = page.pdf(**pdf_options)
            
            # Save PDF to file
            with open(output_path, 'wb') as f:
                f.write(pdf_bytes)
            
            return json.dumps({
                'success': True,
                'filePath': output_path
            })
            
        except Exception as e:
            return json.dumps({
                'success': False,
                'error': str(e)
            })
            
        finally:
            # Clean up
            context.close()
            browser.close()

if __name__ == '__main__':
    input_data = sys.argv[1]
    print(generate_pdf(input_data))