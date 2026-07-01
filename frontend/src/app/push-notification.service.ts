import { Injectable, Inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  
  // The VAPID public key from backend
  readonly VAPID_PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qLOWI-M2X8eF6RStTMI0";

  constructor(@Inject(SwPush) private swPush: SwPush, private http: HttpClient) { }

  subscribeToNotifications() {
    if (this.swPush.isEnabled) {
      this.swPush.requestSubscription({
        serverPublicKey: this.VAPID_PUBLIC_KEY
      })
      .then(sub => {
        console.log('Subscription object:', sub);
        // Send this to our backend
        this.http.post('http://localhost:8086/api/notifications/subscribe', sub).subscribe(
          () => console.log('Successfully subscribed on backend!'),
          err => console.error('Could not send subscription to backend', err)
        );
      })
      .catch(err => console.error('Could not subscribe to notifications', err));
    }
  }
}
