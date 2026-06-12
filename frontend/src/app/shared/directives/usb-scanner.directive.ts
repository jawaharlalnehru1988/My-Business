import { Directive, EventEmitter, HostListener, Output } from '@angular/core';

@Directive({
  selector: '[appUsbScanner]',
  standalone: true
})
export class UsbScannerDirective {
  @Output() onScan = new EventEmitter<string>();
  
  private buffer = '';
  private lastKeyTime = Date.now();
  private readonly threshold = 50; // ms threshold between keystrokes for a scanner

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    const currentTime = Date.now();
    
    // If the gap between keystrokes is too large, it's a human typing, not a scanner.
    if (currentTime - this.lastKeyTime > this.threshold) {
      this.buffer = '';
    }
    
    if (event.key === 'Enter') {
      if (this.buffer.length > 3) {
        this.onScan.emit(this.buffer);
        event.preventDefault(); // Prevent form submission
        this.buffer = '';
      }
    } else if (event.key.length === 1) { 
      // Only capture printable characters
      this.buffer += event.key;
    }
    
    this.lastKeyTime = currentTime;
  }
}
