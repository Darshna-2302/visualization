import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toasts: Toast[] = [];
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  
  getToasts() {
    return this.toastsSubject.asObservable();
  }
  
  showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const toast: Toast = {
      message,
      type,
      id: Date.now()
    };
    
    this.toasts.push(toast);
    this.toastsSubject.next([...this.toasts]);
    
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== toast.id);
      this.toastsSubject.next([...this.toasts]);
    }, 3000);
  }
}