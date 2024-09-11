import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { ChatbotService } from 'src/app/services/chatbot.service';

interface ChatMessage {
  sender: 'user' | 'bot' | 'system';
  message: string;
  images?: string[];
  button?: { name: string; request: any };
  _id?: string;
  time?: string;
  leadInfo?: { leadId: string; leadCreatedTime: string };
}

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ChatbotComponent implements OnInit {
  showBot = false;
  userInput = '';
  showAttachfiles = false;
  activeButtons: HTMLElement[] = [];
  showDatePicker = false;
  selectDate = false;
  showTimePicker = false;
  attachFile = false;
  selectTime = false;
  minDate: Date | undefined = new Date();
  selectedDate: Date | undefined = new Date();
  selectedTime: Date | null = null;
  uploadedImages: string[] = [];
  uploadedVideos: string[] = [];
  selectedFiles: File[] = [];
  uploadSuccess = false;
  sessionId = this.generateSessionId();
  messageHistory: { user: string; bot: string[] }[] = [];
  dynamicButtons: { name: string; request: any }[] = [];
  chatMessages: ChatMessage[] = [];
  isLoading = false;
  showButtons = true;
  hideDynamicButtons = true;
  shouldScrollToBottom = true;
  showTermsandConditions = true;
  showChatBotContent = false;
  acceptedTermsAndCondition = false;
  showError = false;
  isUploading = false;
  services: any = null;
  response: any;
  LeadCreated: any = false;
  LeadResponse: any;
  proLoginId: string | null = null;
  proProfile: any = null;
  bapPrice: any;
  leadId!: string;
  leadCreatedTime: any;
  prosContactedMessage!: any;
  allGetQuestions: any = this.extractQuestions();
  deferredMessages: ChatMessage[] = [];

  constructor(
    private chatbot: ChatbotService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    if (this.isLoggedIn()) {
      this.acceptTermsAndConditions();
      this.startNewSession();
    }
  }

  @ViewChild('chatContainer') private chatContainer?: ElementRef;
  @ViewChild('chatbotInputField')
  chatbotInputField!: ElementRef<HTMLInputElement>;
  @ViewChild('fileInput') fileInput!: ElementRef;

  ngAfterViewChecked() {
    this.scrollToBottom();
    this.cdr.detectChanges();
  }

  private scrollToBottom(): void {
    if (this.chatContainer && this.chatContainer.nativeElement) {
      try {
        this.chatContainer.nativeElement.scrollTop =
          this.chatContainer.nativeElement.scrollHeight;
      } catch (err) {
        console.error('Scroll to bottom failed', err);
      }
    }
  }

  private generateSessionId(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 12 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  }

  private extractDistance(message: string): number {
    const distanceRegex = /(\d+(\.\d+)?)\s?(mi|ft)/;
    const match = message.match(distanceRegex);
    if (!match) return Number.MAX_VALUE;
    const distance = parseFloat(match[1]);
    const unit = match[3];

    if (unit === 'mi') {
      return distance * 5280;
    }
    return distance;
  }

  private async handleResponse(response: any) {
    this.response = response;
    if (response.message) {
      response.message = response.message
        .map((msg: string) => {
          try {
            const parsed = JSON.parse(msg);
            if (parsed) {
              this.services = parsed;
            }
            return null;
          } catch (e) {
            return msg;
          }
        })
        .filter((msg: string | null) => msg !== null);

      const excludedMessages = [
        "Qualified Pro's has been contacted, they will contact you shortly",
        'Qualified Pro has been contacted. He will contact you shortly',
      ];

      const findAProSelected = this.chatMessages.some(
        (msg) => msg.sender === 'user' && msg.message === 'Find a Pro'
      );

      const bookAProSelected = this.chatMessages.some(
        (msg) =>
          (msg.sender === 'user' && msg.message === 'Book a Pro') ||
          (msg.sender === 'user' && msg.message === 'Get a Quote')
      );

      const isMongoDBId = (msg: string) => /^[a-fA-F0-9]{24}$/.test(msg);

      if (response.message.length > 2 && bookAProSelected) {
        this.showButtons = false;
        this.isLoading = true;

        response.message.pop();
        response.message.shift();

        const newArray: { message: string; button: any }[] = [];
        response.message.map((item: string, index: number) => {
          response.buttons.map((item2: any, index2: number) => {
            if (index === index2) {
              newArray.push({ message: item, button: item2 });
            }
          });
        });

        newArray.sort(
          (a, b) =>
            this.extractDistance(a.message) - this.extractDistance(b.message)
        );

        const topThreeMessages = newArray.slice(0, 3);

        topThreeMessages.unshift({
          message: 'Here is a list of Pros that can serve your area.',
          button: null,
        });
        topThreeMessages.push({
          message: 'Which pro do you want to send the request to?',
          button: null,
        });

        this.isLoading = false;

        const newMessages: ChatMessage[] = topThreeMessages.map((msg) => ({
          sender: 'bot',
          message: msg.message,
          button: msg.button,
        }));

        this.chatMessages = [...this.chatMessages, ...newMessages];

        this.hideDynamicButtons = false;
      } else if (
        ((response.message.length === 2 || response.message.length === 3) &&
          findAProSelected &&
          isMongoDBId(response.message[0])) ||
        isMongoDBId(response.message[1])
      ) {
        const processedMessage = this.processMessages(response.message);
        this.chatMessages.push({
          sender: 'bot',
          message: processedMessage.question,
          _id: processedMessage._id,
        });
        this.dynamicButtons = response.buttons;
        this.showButtons = true;
      } else {
        this.hideDynamicButtons = true;
        response.message.forEach((msg: string, index: number) => {
          if (excludedMessages.includes(msg)) {
            if (
              msg.includes(
                "Qualified Pro's has been contacted, they will contact you shortly"
              )
            ) {
              this.deferredMessages.push({
                sender: 'bot',
                message: msg,
              });
              if (findAProSelected) {
                this.constructNewCustomerPayload();
              } else {
                const method = this.extractMethodFromChatMessages();
                this.onBookOrQuoteClick(method);
              }
            } else if (
              msg.includes(
                'Qualified Pro has been contacted. He will contact you shortly'
              )
            ) {
              this.deferredMessages.push({
                sender: 'bot',
                message: msg,
              });
              const method = this.extractMethodFromChatMessages();
              this.onBookOrQuoteClick(method);
            }
            return;
          }

          const botMessage: ChatMessage = { sender: 'bot', message: msg };
          if (response.buttons && response.buttons[index]) {
            botMessage._id = response.buttons[index]._id;
          }
          this.chatMessages.push(botMessage);
          this.updateUiBasedOnMessage(msg);

          if (msg.includes('When is your event')) {
            this.showButtons = true;
          }

          if (
            msg.includes(
              "Qualified Pro's has been contacted, they will contact you shortly"
            ) ||
            msg.includes('Please wait connecting')
          ) {
            if (this.isLoggedIn()) {
              const emailId = this.getEmailId();
              if (emailId) {
                this.fetchCustomerProfile(emailId);
              } else {
                console.error('emailId not found in localStorage');
              }
            } else {
              console.error('User not logged in');
            }
          }
        });
      }
    }

    if (response.buttons) {
      this.dynamicButtons = response.buttons;
      this.showButtons = true;
    } else {
      this.showButtons = false;
    }
  }

  private updateUiBasedOnMessage(msg: string) {
    const lowerCaseMsg = msg.toLowerCase();
    if (/time|what time|provide a time/.test(lowerCaseMsg)) {
      this.showDatePicker = false;
      this.showTimePicker = true;
      this.showAttachfiles = false;
    } else if (
      /date|what date|provide a date|When is your event/.test(lowerCaseMsg)
    ) {
      this.showDatePicker = true;
      this.showTimePicker = false;
      this.showAttachfiles = false;
    } else if (/attach|would you like to attach/.test(lowerCaseMsg)) {
      this.showTimePicker = false;
      this.showDatePicker = false;
      this.showAttachfiles = true;
    } else {
      this.showTimePicker = false;
      this.showDatePicker = false;
      this.showAttachfiles = false;
      this.showButtons = false;
    }
  }

  private isLoggedIn(): boolean {
    const currentUser = localStorage.getItem('currentUser');
    return currentUser !== null;
  }

  private getEmailId(): string | null {
    return localStorage.getItem('emailId');
  }

  private getLoginId(): string | null {
    return localStorage.getItem('loginId');
  }

  private fetchCustomerProfile(emailId: string) {
    const apiUrl = `https://testapi.topproz.com/customer/getCustomerProfileDeatils/${emailId}`;
    this.chatbot.getCustomerProfile(apiUrl).subscribe(
      (response) => {
        if (response.status === 200 && response.result === 'success') {
          this.constructPayload(response.data[0]);
        } else {
          this.constructNewCustomerPayload();
        }
      },
      (error) => {
        console.error('API error:', error);
      }
    );
  }

  extractImagesFromChatMessages(): string[] {
    const images: string[] = [];
    this.chatMessages.forEach((message) => {
      if (message.images && message.images.length > 0) {
        images.push(...message.images);
      }
    });
    return images;
  }

  private extractZipcodeFromMessages(): string {
    const zipCodeRegex = /\b\d{5}(?:-\d{4})?\b/;
    for (const message of this.chatMessages) {
      if (message.sender === 'user') {
        const match = message.message.match(zipCodeRegex);
        if (match) {
          return match[0];
        }
      }
    }
    return '';
  }

  private extractStreetAddressFromMessages(): string {
    const addressPrompts = [
      'Please provide your street address where you want to avail this service.',
      'Please provide your street address for service.',
      'Please provide the service street address',
    ];

    for (let i = 0; i < this.chatMessages.length; i++) {
      const botMessage = this.chatMessages[i];
      const userMessage = this.chatMessages[i + 1];

      if (botMessage.sender === 'bot' && userMessage?.sender === 'user') {
        if (
          addressPrompts.some((prompt) => botMessage.message.includes(prompt))
        ) {
          return userMessage.message;
        }
      }
    }
    return '';
  }

  private extractCustomerInfo(prompt: string): string {
    for (let i = 0; i < this.chatMessages.length; i++) {
      const botMessage = this.chatMessages[i];
      const userMessage = this.chatMessages[i + 1];

      if (botMessage.sender === 'bot' && userMessage?.sender === 'user') {
        if (botMessage.message.includes(prompt)) {
          return userMessage.message;
        }
      }
    }
    return '';
  }

  private constructNewCustomerPayload() {
    const firstName = this.extractCustomerInfo('Please enter your first name');
    const lastName = this.extractCustomerInfo('What is your last name');
    const emailId = this.extractCustomerInfo(
      'Please provide your email address'
    );
    const mobileNumber = this.extractCustomerInfo(
      'Please enter your phone number'
    );
    const businessStreetAddress = this.extractCustomerInfo(
      'Please provide your address'
    );
    const serviceStreetAddress = this.extractCustomerInfo(
      'Please provide the service street address'
    );
    const serviceZipCode = this.extractCustomerInfo(
      'Alright! provide your service address zip code.'
    );
    const customerType = this.extractCustomerInfo(
      'What type of customer you are?'
    );

    const businessName = this.extractCustomerInfo(
      'Ok, What is your business name?'
    );

    this.chatbot.getZipcodeData(serviceZipCode).subscribe(
      (response) => {
        if (
          response.status === 200 &&
          response.result === 'success' &&
          response.data.length > 0
        ) {
          const zipData = response.data[0];

          const serviceAddress = {
            streetAddress: serviceStreetAddress,
            city: zipData.city,
            state: zipData.state,
            zipcode: zipData.zipcode,
          };

          const newCustomerPayload = {
            firstName: firstName,
            lastName: lastName,
            customerType: customerType,
            businessName: businessName,
            emailId: emailId,
            mobileNumber: mobileNumber,
            businessAddress: {
              streetAddress: businessStreetAddress,
              city: zipData.city,
              state: zipData.state,
              zipcode: serviceZipCode,
            },
            serviceAddress: serviceAddress,
            questions: this.extractQuestions(),
            sourceType: this.determineSourceType(),
            acceptedTermsAndConditions: this.acceptedTermsAndCondition,
            attachments: this.extractImagesFromChatMessages(),
            image: this.extractImagesFromChatMessages(),
            service: this.services,
          };

          this.chatbot.createNewLead(newCustomerPayload).subscribe(
            (res) => {
              if (res.status === 200 && res.result === 'success') {
                this.LeadCreated = true;

                const leadData = res.data.leadData;

                this.leadId = leadData.leadId;
                this.leadCreatedTime = leadData.todayTime;

                this.chatMessages.push({
                  sender: 'system',
                  message: '',
                  leadInfo: {
                    leadId: this.leadId,
                    leadCreatedTime: this.leadCreatedTime,
                  },
                });

                this.chatMessages.push(...this.deferredMessages);

                // Clear deferredMessages array after use
                this.deferredMessages = [];

                const matchingProsPayload = {
                  customerType: leadData.customerType,
                  businessName: leadData.businessName || '',
                  zipcode: leadData.serviceAddress.zipcode,
                  categoryCode: newCustomerPayload.service.categoryCode,
                  subCategoryCode: newCustomerPayload.service.subCategoryCode,
                  customerId: leadData.customerId,
                  customer: leadData._id,
                  leadId: leadData.leadId,
                  loginId: leadData.loginId,
                  firstName: leadData.basicDetails.firstName,
                  lastName: leadData.basicDetails.lastName,
                  mobileNumber: leadData.basicDetails.mobileNumber,
                  emailId: leadData.basicDetails.emailId,
                  streetAddress: leadData.serviceAddress.streetAddress,
                  city: leadData.serviceAddress.city,
                  state: leadData.serviceAddress.state,
                  isServiceEmergency: 'NO',
                  service: leadData.service,
                  questions: leadData.questions,
                  acceptedTermsAndConditions:
                    leadData.acceptedTermsAndConditions,
                  bestRatingProsFlag: false,
                  description: leadData.aboutProject.description,
                  attachments: leadData.aboutProject.attachments,
                  createdBy: leadData.basicDetails.emailId,
                  createdOn: leadData.createdAt,
                  modifiedBy: leadData.basicDetails.emailId,
                  modifiedOn: new Date().toISOString(),
                  sourceType: leadData.sourceType,
                };

                this.chatbot.matchingProsForLead(matchingProsPayload).subscribe(
                  (matchingProsResponse) => {
                    console.log(
                      'Matching pros response:',
                      matchingProsResponse
                    );
                  },
                  (error) => {
                    console.error('Error matching pros for lead', error);
                  }
                );
              }
            },
            (error) => {
              console.error('Error creating lead', error);
            }
          );
        } else {
          console.error('Failed to fetch zipcode data', response);
        }
      },
      (error) => {
        console.error('API error:', error);
      }
    );
  }

  private constructPayload(data: any) {
    const questions = this.extractQuestions();
    const sourceType = this.determineSourceType();
    const images = this.extractImagesFromChatMessages();
    const zipcode = this.extractZipcodeFromMessages();
    const streetAddress = this.extractStreetAddressFromMessages();

    this.chatbot.getZipcodeData(zipcode).subscribe(
      (response) => {
        if (
          response.status === 200 &&
          response.result === 'success' &&
          response.data.length > 0
        ) {
          const zipData = response.data[0];
          const serviceAddress = {
            streetAddress: streetAddress,
            city: zipData.city,
            state: zipData.state,
            zipcode: zipData.zipcode,
          };

          const payload = {
            firstName: data.CustomerBillingAddress.firstName,
            lastName: data.CustomerBillingAddress.lastName,
            customerType: data.customerType,
            emailId: data.CustomerBillingAddress.emailId,
            mobileNumber: data.CustomerBillingAddress.phoneNumber,
            loginId: this.getLoginId(),
            businessAddress: {
              streetAddress: data.CustomerBillingAddress.address,
              city: data.CustomerBillingAddress.city,
              state: data.CustomerBillingAddress.state,
              zipcode: data.CustomerBillingAddress.zipCode,
            },
            serviceAddress: serviceAddress,
            questions: questions,
            sourceType: sourceType,
            acceptedTermsAndConditions: this.acceptedTermsAndCondition,
            attachments: images,
            image: images,
            service: this.services,
          };

          console.log('Existing Customer Lead', payload);

          this.chatbot.createExistLead(payload).subscribe(
            (res) => {
              if (res.status === 200 && res.result === 'success') {
                this.LeadCreated = true;
                const leadData = res.data.leadData;

                this.leadId = leadData.leadId;
                this.leadCreatedTime = leadData.todayTime;

                this.chatMessages.push({
                  sender: 'system',
                  message: '',
                  leadInfo: {
                    leadId: this.leadId,
                    leadCreatedTime: this.leadCreatedTime,
                  },
                });

                this.chatMessages.push(...this.deferredMessages);

                // Clear deferredMessages array after use
                this.deferredMessages = [];

                const matchingProsPayload = {
                  customerType: leadData.customerType,
                  businessName: leadData.businessName || '',
                  zipcode: leadData.serviceAddress.zipcode,
                  categoryCode: payload.service.categoryCode,
                  subCategoryCode: payload.service.subCategoryCode,
                  customerId: leadData.customerId,
                  customer: data._id,
                  leadId: leadData.leadId,
                  loginId: leadData.loginId,
                  firstName: leadData.basicDetails.firstName,
                  lastName: leadData.basicDetails.lastName,
                  mobileNumber: leadData.basicDetails.mobileNumber,
                  emailId: leadData.basicDetails.emailId,
                  streetAddress: leadData.serviceAddress.streetAddress,
                  city: leadData.serviceAddress.city,
                  state: leadData.serviceAddress.state,
                  isServiceEmergency: 'NO',
                  service: leadData.service,
                  questions: leadData.questions,
                  acceptedTermsAndConditions:
                    leadData.acceptedTermsAndConditions,
                  bestRatingProsFlag: false,
                  description: leadData.aboutProject.description,
                  attachments: leadData.aboutProject.attachments,
                  createdBy: leadData.basicDetails.emailId,
                  createdOn: leadData.createdAt,
                  modifiedBy: leadData.basicDetails.emailId,
                  modifiedOn: new Date().toISOString(),
                  sourceType: leadData.sourceType,
                };

                this.chatbot.matchingProsForLead(matchingProsPayload).subscribe(
                  (matchingProsResponse) => {
                    console.log(
                      'Matching pros response:',
                      matchingProsResponse
                    );
                  },
                  (error) => {
                    console.error('Error matching pros for lead', error);
                  }
                );
              }
            },
            (error) => {
              console.error('Error creating lead', error);
            }
          );
        } else {
          console.error('Failed to fetch zipcode data', response);
        }
      },
      (error) => {
        console.error('API error:', error);
      }
    );
  }

  private extractQuestions(): any[] {
    const questions: any[] = [];
    let startCollecting = false;
    let stopCollecting = false;

    // Find the last occurrence of "Find a Pro"
    let lastFindAProIndex = -1;
    for (let i = 0; i < this.chatMessages.length; i++) {
      if (this.chatMessages[i].message.includes('Find a Pro')) {
        lastFindAProIndex = i;
      }
    }

    // Start collecting messages after the last "Find a Pro"
    for (let i = lastFindAProIndex + 1; i < this.chatMessages.length; i++) {
      const currentMessage = this.chatMessages[i];

      if (
        currentMessage.sender === 'bot' &&
        (currentMessage.message.includes('Alright, please provide a Date') ||
          currentMessage.message.includes('Okay, what date do you want') ||
          currentMessage.message.includes('What date do you want'))
      ) {
        stopCollecting = true;
        break;
      }

      if (!stopCollecting && currentMessage.sender === 'bot') {
        const nextMessage = this.chatMessages[i + 1];
        if (nextMessage && nextMessage.sender === 'user') {
          questions.push({
            question: currentMessage.message,
            answer: nextMessage.message,
            _id: currentMessage._id || '',
          });

          i++; // Skip next message since it's already processed as an answer
        }
      }
    }

    return questions;
  }

  private determineSourceType(): string {
    if (this.chatMessages.find((msg) => msg.message.includes('Find a Pro'))) {
      return 'Standard';
    } else if (
      this.chatMessages.find((msg) => msg.message.includes('Book a pro'))
    ) {
      return 'DirectBooking';
    } else if (
      this.chatMessages.find((msg) => msg.message.includes('Get a quote'))
    ) {
      return 'Getaquotes';
    }
    return 'Standard';
  }

  processMessages(messages: string[]): { _id: string; question: string } {
    let result = { _id: '', question: '' };

    if (messages.length === 3) {
      result = {
        _id: messages[1],
        question: messages[2],
      };
    } else if (messages.length === 2) {
      result = {
        _id: messages[0],
        question: messages[1],
      };
    }
    console.log('result', result);
    return result;
  }

  acceptTermsAndConditions() {
    this.acceptedTermsAndCondition = true;
    this.showTermsandConditions = false;
    this.showChatBotContent = true;

    this.chatMessages.push({
      sender: 'system',
      message: 'Terms and conditions accepted.',
    });
  }

  startNewSession() {
    this.sessionId = this.generateSessionId();
    this.chatMessages = [];
    this.dynamicButtons = [];
    this.showButtons = false;
    const greetingMessage = 'Hi';
    this.isLoading = true;

    const payload = { payload: greetingMessage, type: 'text' };
    this.chatbot
      .sendMessage(
        payload.payload,
        payload.type,
        this.sessionId,
        this.isLoggedIn()
      )
      .subscribe(
        (response) => {
          this.handleResponse(response);
          this.isLoading = false;
          this.showChatBotContent = true;
          this.showTermsandConditions = false;
        },
        (error) => {
          console.error('Error sending message:', error);
          this.isLoading = false;
        }
      );
  }

  closeChat() {
    this.showBot = false;
  }

  showChatBot() {
    if (!this.acceptedTermsAndCondition) {
      this.showTermsandConditions = true;
    } else {
      this.showBot = true;
    }
  }

  startChatAfterAcceptance() {
    if (!this.acceptedTermsAndCondition) {
      this.showError = true;
    } else {
      this.acceptTermsAndConditions();
      this.showChatBot();
      this.showError = false;
      this.startNewSession();
    }
  }

  clearError() {
    this.showError = false;
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.onSendButtonClick();
    }
  }

  onSendButtonClick() {
    if (this.userInput.trim() !== '' || this.uploadedImages.length > 0) {
      let userMessage = this.userInput.trim();
      const currentTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      if (this.uploadedImages.length > 0) {
        this.chatMessages.push({
          sender: 'user',
          message: '',
          images: [...this.uploadedImages],
          time: currentTime,
        });
        this.uploadedImages = [];
        this.userInput = '';
        userMessage = `${this.uploadedImages.length} Images`;
      } else {
        this.chatMessages.push({
          sender: 'user',
          message: userMessage,
          time: currentTime,
        });
        this.userInput = '';
      }
      this.shouldScrollToBottom = true;
      this.isLoading = true;
      this.showButtons = false;

      const payload = { payload: userMessage, type: 'text' };

      this.chatbot
        .sendMessage(
          payload.payload,
          payload.type,
          this.sessionId,
          this.isLoggedIn()
        )
        .subscribe(
          (response) => {
            this.handleResponse(response);
            this.isLoading = false;
          },
          (error) => {
            console.error('Error sending message:', error);
            this.isLoading = false;
          }
        );
    }
  }

  private processApiRequest(request: any): Observable<any> {
    const payload = {
      payload: request,
      type: 'button',
      sessionId: this.sessionId,
    };
    return this.chatbot.sendMessage(
      payload.payload,
      payload.type,
      this.sessionId,
      this.isLoggedIn()
    );
  }

  private handleNewServiceRequest(request: any) {
    this.showTermsandConditions = true;
    this.showChatBotContent = false;
    this.isLoading = true;
    this.showButtons = false;

    this.processApiRequest(request).subscribe(
      (response) => {
        this.handleResponse(response);
        this.isLoading = false;
        this.shouldScrollToBottom = true;
      },
      (error) => {
        console.error('Error sending message:', error);
        this.isLoading = false;
        this.shouldScrollToBottom = true;
      }
    );
  }

  private extractMethodFromChatMessages(): string | null {
    for (let i = 0; i < this.chatMessages.length; i++) {
      const botMessage = this.chatMessages[i];
      const userMessage = this.chatMessages[i + 1];

      if (
        botMessage.sender === 'bot' &&
        botMessage.message.includes(
          'Alright! Please select one of these choices..'
        )
      ) {
        if (userMessage && userMessage.sender === 'user') {
          return userMessage.message;
        }
      }
    }
    return null;
  }

  private handleOtherRequests(request: any) {
    this.isLoading = true;
    this.showButtons = false;

    this.processApiRequest(request).subscribe(
      (response) => {
        this.handleResponse(response);
        this.isLoading = false;
        this.shouldScrollToBottom = true;
      },
      (error) => {
        console.error('Error sending message:', error);
        this.isLoading = false;
        this.shouldScrollToBottom = true;
      }
    );
  }

  onButtonLayerClick(request: any) {
    const userMessage = request.payload.label;
    const currentTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    this.chatMessages.push({
      sender: 'user',
      message: userMessage,
      time: currentTime,
    });

    this.proLoginId = request?.payload?.action;

    if (this.proLoginId) {
      this.chatbot.getProProfile(this.proLoginId).subscribe(
        (response) => {
          this.proProfile = response.data;
        },
        (error) => {
          console.error('Error fetching pro profile:', error);
        }
      );
    }

    console.log(this.proProfile);

    if (userMessage === 'Find a Pro') {
      this.handleOtherRequests(request);
    } else {
      this.handleOtherRequests(request);
    }
  }

  onInputChange() {
    if (this.userInput === '') {
      this.showDatePicker = false;
      this.selectDate = false;
      this.showTimePicker = false;
      this.showAttachfiles = false;
    }
  }

  onButtonDateLayerClick(event: Event) {
    this.selectDate = true;
    this.selectTime = false;
    this.attachFile = false;
    this.toggleActiveButton(event);
  }

  onButtonTimeLayerClick(event: Event) {
    this.selectTime = true;
    this.selectDate = false;
    this.attachFile = false;
    this.toggleActiveButton(event);
  }

  onAttachButtonClick(event: Event) {
    this.attachFile = true;
    this.selectDate = false;
    this.selectTime = false;
    this.toggleActiveButton(event);
  }

  onThanksButtonClick() {
    this.userInput = 'No Thanks';
  }

  onSelectDateButtonClick() {
    this.selectDate = true;
  }

  closePopup() {
    this.selectDate = false;
  }

  closeTimePopup() {
    this.selectTime = false;
  }

  closeAttachFile() {
    if (!this.isUploading) {
      this.attachFile = false;
    }
  }

  closeChats() {
    this.LeadCreated = false;
    this.showBot = false;
    this.resetChat();
    this.acceptedTermsAndCondition = false;
  }

  private resetChat() {
    this.sessionId = this.generateSessionId();
    this.chatMessages = [];
    this.dynamicButtons = [];
    this.showButtons = false;
    this.showDatePicker = false;
    this.showTimePicker = false;
    this.showAttachfiles = false;
    this.selectDate = false;
    this.selectTime = false;
    this.attachFile = false;
  }

  updateUserInputWithTime() {
    if (this.selectedTime) {
      this.userInput = `Selected time: ${this.selectedTime.toLocaleTimeString()}`;
    }
  }

  updateUserInputWithDate() {
    if (this.selectedDate) {
      this.userInput = `${this.selectedDate.toLocaleDateString()}`;
    }
  }

  triggerFileInput() {
    const fileInput = this.fileInput.nativeElement;
    fileInput.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.isUploading = true;
      this.selectedFiles = Array.from(input.files);

      // Clear any existing file data sets or temporarily hold them here
      this.uploadSelectedFiles(); // Trigger the upload process
    }
  }

  deleteImage(index: number) {
    this.uploadedImages.splice(index, 1);
    this.updateUserInputWithFileCounts();
  }

  deleteVideo(index: number) {
    this.uploadedVideos.splice(index, 1);
    this.updateUserInputWithFileCounts();
  }

  submitSelectedDate() {
    if (this.selectedDate) {
      this.userInput = `${this.selectedDate.toLocaleDateString()}`;
      this.showDatePicker = false;
      this.selectDate = false;
    }
  }

  submitSelectedTime() {
    if (this.selectedTime) {
      const now = new Date();
      const selectedDate = new Date(this.selectedDate || now);

      // Combine selected date and time
      selectedDate.setHours(
        this.selectedTime.getHours(),
        this.selectedTime.getMinutes()
      );

      if (selectedDate < now) {
        alert('Please select a future time.');
        return;
      }

      const hours = this.selectedTime.getHours();
      const minutes = this.selectedTime.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
      const formattedTime = `${formattedHours}:${formattedMinutes} ${ampm}`;

      this.userInput = `${formattedTime}`;
      this.showTimePicker = false;
      this.selectTime = false;
    }
  }

  private toggleActiveButton(event: Event) {
    const button = event.target as HTMLElement;
    if (this.activeButtons.includes(button)) {
      button.classList.remove('active-button');
      this.activeButtons = this.activeButtons.filter((btn) => btn !== button);
    } else {
      button.classList.add('active-button');
      this.activeButtons.push(button);
    }
  }

  uploadSelectedFiles() {
    if (this.selectedFiles.length > 0) {
      this.isUploading = true;

      this.chatbot.uploadFiles(this.selectedFiles).subscribe(
        (response) => {
          if (response.status === 200 && response.result === 'success') {
            this.uploadSuccess = true;
            this.selectedFiles = [];
            response.data.uploadedImagePath.forEach((file: any) => {
              const isVideo =
                file.location.endsWith('.mp4') ||
                file.location.endsWith('.avi');
              if (isVideo) {
                this.uploadedVideos.push(file.location);
              } else {
                this.uploadedImages.push(file.location);
              }
            });

            this.updateUserInputWithFileCounts();
          } else {
            console.error('Failed to upload files', response);
          }
          this.isUploading = false;
        },
        (error) => {
          console.error('Error uploading files:', error);
          this.isUploading = false;
        }
      );
    }
  }

  private updateUserInputWithFileCounts() {
    const imageCount = this.uploadedImages.length;
    const videoCount = this.uploadedVideos.length;
    this.userInput = `${imageCount} Images, ${videoCount} Videos`;
  }

  dateFilter = (d: Date | null): boolean => {
    const today = new Date();
    return d ? d >= today : false;
  };

  fetchBapPrice() {
    this.chatbot
      .getSubCategoriesByCatCode(this.services.categoryCode)
      .subscribe(
        (response) => {
          if (response.status === 200 && response.result === 'success') {
            const subcategories = response.data;

            const matchedSubcategory = subcategories.find(
              (sub: any) =>
                sub.cat_code == this.services.categoryCode &&
                sub.subcat_code == this.services.subCategoryCode
            );
            console.log('Matched Catergory', matchedSubcategory);
            if (matchedSubcategory) {
              this.bapPrice = matchedSubcategory.bapPrice;
              console.log('this bap price', this.bapPrice);
            } else {
              console.error('No matching subcategory found');
            }
          } else {
            console.error('Failed to fetch subcategories', response);
          }
        },
        (error) => {
          console.error('API error:', error);
        }
      );
  }

  private buildBookAndGetQuotePayload(selectedMethod: any, data: any) {
    const isLoggedIn = this.isLoggedIn();
    const zipcode = this.extractZipcodeFromMessages();
    const streetAddress = this.extractStreetAddressFromMessages();

    let customerInfo = {
      firstName: '',
      lastName: '',
      mobileNumber: '',
      emailId: '',
      serviceAddress: {
        streetAddress: '',
        city: '',
        state: '',
        zipcode: '',
      },
      isUserNotExist: !isLoggedIn,
    };

    if (isLoggedIn) {
      const emailId = this.getEmailId();
      if (emailId) {
        this.fetchCustomerProfile(emailId);
        customerInfo = {
          firstName: data.CustomerBillingAddress.firstName,
          lastName: data.CustomerBillingAddress.lastName,
          emailId: data.CustomerBillingAddress.emailId,
          mobileNumber: data.CustomerBillingAddress.phoneNumber,
          serviceAddress: {
            streetAddress: data.CustomerBillingAddress.address,
            city: data.CustomerBillingAddress.city,
            state: data.CustomerBillingAddress.state,
            zipcode: data.CustomerBillingAddress.zipCode,
          },
          isUserNotExist: false,
        };
      }
    } else {
      customerInfo.firstName = this.extractCustomerInfo(
        'Please enter your first name'
      );
      customerInfo.lastName = this.extractCustomerInfo(
        'What is your last name'
      );
      customerInfo.mobileNumber = this.extractCustomerInfo(
        'Please enter your phone number'
      );
      customerInfo.emailId = this.extractCustomerInfo(
        'Please provide your email address'
      );
      customerInfo.serviceAddress.streetAddress =
        this.extractStreetAddressFromMessages();
      customerInfo.serviceAddress.zipcode = this.extractZipcodeFromMessages();

      this.chatbot.getZipcodeData(zipcode).subscribe(
        (response) => {
          if (
            response.status === 200 &&
            response.result === 'success' &&
            response.data.length > 0
          ) {
            const zipData = response.data[0];
            customerInfo.serviceAddress.city = zipData.city;
            customerInfo.serviceAddress.state = zipData.state;
            const serviceAddress = {
              streetAddress: customerInfo.serviceAddress.streetAddress,
              city: zipData.city,
              state: zipData.state,
              zipcode: zipData.zipcode,
            };
          } else {
            console.error('Failed to fetch zipcode data', response);
          }
        },
        (error) => {
          console.error('API error:', error);
        }
      );
    }
    const payload = {
      projectName: this.services.category + this.services.subCategory,
      projectDescription: '',
      firstName: customerInfo.firstName,
      lastName: customerInfo.lastName,
      mobileNumber: customerInfo.mobileNumber,
      DBLeadEmailId: customerInfo.emailId,
      loginId: this.proProfile.loginId,
      proLoginId: this.proProfile.loginId,
      proId: this.proProfile.proId,
      proEmailId: this.proProfile.emailId,
      proMobileNumber: this.proProfile.mobileNumber,
      proName: this.proProfile.businessName,

      isUserNotExist: customerInfo.isUserNotExist,

      isGetquotes: selectedMethod === 'Get a Quote',
      isBookapro: selectedMethod === 'Book a Pro',

      bookingDate:
        selectedMethod === 'Book a Pro'
          ? this.selectedDate?.toLocaleDateString()
          : null,
      bookingTime:
        selectedMethod === 'Book a Pro'
          ? this.selectedTime?.toLocaleTimeString()
          : null,
      DBLPrice: Number(this.bapPrice),
      serviceAddress: customerInfo.serviceAddress,
      attachments: this.uploadedImages.map((image) => ({
        fileName: image.split('/').pop(),
        fileUrl: image,
        extension: image.split('.').pop(),
      })),
      service: this.services,
      hasEmailSubscriptionFlag: true,
      acceptedTermsAndConditions: this.acceptedTermsAndCondition,
      sourceType:
        selectedMethod === 'Book a Pro' ? 'DirectBooking' : 'Getaquotes',
      createdOn: new Date().toISOString(),

      proInfo: {
        firstName: this.proProfile.firstName,
        lastName: this.proProfile.lastName,
        mobileNumber: this.proProfile.mobileNumber,
        businessAddress: this.proProfile.businessAddress.streetAddress,
        city: this.proProfile.city,
        state: this.proProfile.state,
        zipcode: this.proProfile.zipcode,
        businessName: this.proProfile.businessName,
        yelpRating: this.proProfile.socialMediaLinks.yelpRating,
        googleRating: this.proProfile.socialMediaLinks.googleRating,
        proId: this.proProfile.proId,
        loginId: this.proProfile.loginId,
        companyLogo: this.proProfile.companyLogo,
      },
    };

    return payload;
  }

  onBookOrQuoteClick(selectedMethod: any) {
    this.fetchBapPrice();
    const emailId = this.getEmailId();
    if (emailId) {
      const apiUrl = `https://testapi.topproz.com/customer/getCustomerProfileDeatils/${emailId}`;
      this.chatbot.getCustomerProfile(apiUrl).subscribe(
        (response) => {
          if (response.status === 200 && response.result === 'success') {
            const payload = this.buildBookAndGetQuotePayload(
              selectedMethod,
              response.data[0]
            );

            this.sendBookOrQuoteRequest(payload);
          } else {
            console.error('Failed to fetch customer profile', response);
          }
        },
        (error) => {
          console.error('API error:', error);
        }
      );
    } else {
      const payload = this.buildBookAndGetQuotePayload(selectedMethod, null);

      this.sendBookOrQuoteRequest(payload);
    }
  }

  sendBookOrQuoteRequest(payload: any) {
    this.chatbot.directBookingCustomer(payload).subscribe(
      (res) => {
        if (res.status === 200 && res.result === 'success') {
          this.LeadCreated = true;
          const LeadResponse = res.data;
          this.leadId = LeadResponse.directBookingLead.directBookingLeadId;
          this.leadCreatedTime = LeadResponse.directBookingLead.createdOn;

          this.chatMessages.push({
            sender: 'system',
            message: '',
            leadInfo: {
              leadId: this.leadId,
              leadCreatedTime: this.leadCreatedTime,
            },
          });

          this.chatMessages.push(...this.deferredMessages);

          // Clear deferredMessages array after use
          this.deferredMessages = [];
          console.log('Request successful', res);
        } else {
          console.error('Request failed', res);
        }
      },
      (error) => {
        console.error('Error processing request:', error);
      }
    );
  }

  navigateToCreatedLead() {
    this.router.navigate(['/customer/lead-list']);
  }

  toggleChatBotVisibility() {
    this.showBot = !this.showBot;
    this.showTermsandConditions = true;
    this.showChatBotContent = false;
  }
}
