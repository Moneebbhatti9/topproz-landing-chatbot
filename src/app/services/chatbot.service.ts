import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ChatbotService {
  topProzBaseUrl = 'https://testapi.topproz.com';
  newCustomerbaseUrl =
    'https://ai-top-proz-backend.onrender.com/chatbot/newCustomerFlow';
  existingCustomerbaseUrl =
    'https://ai-top-proz-backend.onrender.com/chatbot/existingCustomerFlow';

  constructor(private http: HttpClient) {}

  sendMessage(
    payload: any,
    type: string,
    sessionId: string,
    isLoggedIn: boolean
  ): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    const body = {
      payload: payload,
      type: type,
      sessionId: sessionId,
    };

    const url = isLoggedIn
      ? this.existingCustomerbaseUrl
      : this.newCustomerbaseUrl;

    return this.http.post<any>(url, body, { headers: headers });
  }

  getCustomerProfile(url: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    return this.http.get<any>(url, { headers: headers });
  }

  uploadFiles(files: File[]): Observable<any> {
    const formData: FormData = new FormData();
    files.forEach((file) => {
      formData.append('images', file, file.name);
    });

    return this.http.post<any>(
      `${this.topProzBaseUrl}/fileupload/multipleImageUploader`,
      formData
    );
  }

  createExistLead(payload: any): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    return this.http.post<any>(
      `${this.topProzBaseUrl}/lead/createExistlead`,
      payload,
      { headers: headers }
    );
  }

  getZipcodeData(zipcode: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    return this.http.get<any>(
      `${this.topProzBaseUrl}/master/getzipcodedata/${zipcode}`,
      { headers: headers }
    );
  }

  matchingProsForLead(payload: any): Observable<any> {
    const apiUrl = `${this.topProzBaseUrl}/lead/matchingprosforlead`;
    return this.http.post(apiUrl, payload);
  }

  createNewLead(payload: any): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    return this.http.post<any>(
      `${this.topProzBaseUrl}/lead/createlead`,
      payload,
      { headers: headers }
    );
  }

  getProProfile(proLoginId: string): Observable<any> {
    return this.http.get<any>(
      `${this.topProzBaseUrl}/pro/getproprofileNoJWT/${proLoginId}`
    );
  }

  // https://testapi.topproz.com/pro/getproprofileNoJWT/6581ce89a8d59021fe8d48e7

  directBookingCustomer(payload: any): Observable<any> {
    const url = `${this.topProzBaseUrl}/lead/direct-booking-customer`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    return this.http.post<any>(url, payload, { headers: headers });
  }

  getSubCategoriesByCatCode(categoryCode: string): Observable<any> {
    const url = `${this.topProzBaseUrl}/master/getSubCategoriesByCatCode/${categoryCode}`;
    return this.http.get<any>(url);
  }
}
