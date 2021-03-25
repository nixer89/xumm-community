import { Component, ViewChild, Output, EventEmitter, OnInit, OnDestroy, Input } from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { DeviceDetectorService } from 'ngx-device-detector';
import { XummTypes } from 'xumm-sdk';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AccountInfoChanged, XrplAccountChanged } from 'src/app/utils/types';
import * as normalizer from '../../utils/normalizers'
import { isValidXRPAddress } from 'src/app/utils/utils';
import { FormControl } from '@angular/forms';
import { DateAdapter } from '@angular/material/core';

@Component({
  selector: 'escrowcreate',
  templateUrl: './escrowcreate.html'
})
export class EscrowCreateComponent implements OnInit, OnDestroy{

  constructor(private device:DeviceDetectorService, private dateAdapter: DateAdapter<any>, private googleAnalytics: GoogleAnalyticsService) {}

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<any>;

  @Output()
  onPayload: EventEmitter<XummTypes.XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpamount') inpamount;
  amountInput: string;

  @ViewChild('inpdestination') inpdestination;
  destinationInput: string;

  @ViewChild('inpcancelaftertime') inpcancelaftertime;
  cancelafterTimeInput: any;

  @ViewChild('inpfinishaftertime') inpfinishaftertime;
  finishafterTimeInput: any;

  @ViewChild('inppassword') password;
  passwordInput: string;

  originalAccountInfo:any;
  private accountInfoChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;
  escrowAccountChanged: Subject<XrplAccountChanged> = new Subject<XrplAccountChanged>();

  isValidEscrow:boolean = false;
  validAmount:boolean = false;
  validAddress:boolean = false;
  validCancelAfter:boolean = false;
  validFinishAfter:boolean = false;
  validCondition:boolean = false;

  cancelAfterDateTime:Date;
  finishAfterDateTime:Date;

  finishAfterFormCtrl:FormControl = new FormControl();
  cancelAfterFormCtrl:FormControl = new FormControl();

  cancelDateInFuture:boolean = false;
  finishDateInFuture:boolean = false;
  cancelDateBeforeFinishDate:boolean = false;

  escrowYears:number = 0;
  maxSixDigits:boolean = false;

  dateTimePickerSupported:boolean = true;

  hidePw = true;

  ngOnInit() {
    this.dateAdapter.setLocale(this.getUsersLocale("en"));
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received")
      this.originalAccountInfo = accountData.info;
      if(this.originalAccountInfo && this.originalAccountInfo.Account && isValidXRPAddress(this.originalAccountInfo.Account)) {
        this.escrowAccountChanged.next({account: this.originalAccountInfo.Account, mode: accountData.mode});
      }

    });

    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.clearInputs()
    });

    //this.dateTimePickerSupported = !(this.device && this.device.getDeviceInfo() && this.device.getDeviceInfo().os_version && (this.device.getDeviceInfo().os_version.toLowerCase().includes('ios') || this.device.getDeviceInfo().browser.toLowerCase().includes('safari') || this.device.getDeviceInfo().browser.toLowerCase().includes('edge')));
    this.dateTimePickerSupported = true;
  }

  ngOnDestroy() {
    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();

    if(this.transactionSuccessfullSubscription)
      this.transactionSuccessfullSubscription.unsubscribe();
  }

  getUsersLocale(defaultValue: string): string {
    if (typeof window === 'undefined' || typeof window.navigator === 'undefined') {
      return defaultValue;
    }
    const wn = window.navigator as any;
    let lang = wn.languages ? wn.languages[0] : defaultValue;
    lang = lang || wn.language || wn.browserLanguage || wn.userLanguage;
    return lang;
  }

  checkChanges() {
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);
    
    //console.log("cancelAfterFormCtrl: " + this.cancelAfterFormCtrl);
    //console.log("finishafterTimeInput: " + this.finishafterTimeInput);

    if(this.finishAfterFormCtrl && this.finishAfterFormCtrl.value && this.finishafterTimeInput) {
      let datePicker = new Date(this.finishAfterFormCtrl.value);
      this.finishAfterDateTime = new Date(datePicker.getFullYear() + "-" + ((datePicker.getMonth()+1) < 10 ? "0":"")+(datePicker.getMonth()+1) + "-" + datePicker.getDate() + "T" + this.finishafterTimeInput.trim());    
    }
    else
      this.finishAfterDateTime = null;
    
    
    this.finishDateInFuture = this.finishAfterDateTime != null && this.finishAfterDateTime.getTime() < Date.now();
    this.validFinishAfter = this.finishAfterDateTime != null && this.finishAfterDateTime.getTime() > 0 && !this.finishDateInFuture;
    
    if(this.finishAfterDateTime)
      this.escrowYears = this.finishAfterDateTime.getFullYear() - (new Date()).getFullYear();

    if(this.cancelAfterFormCtrl && this.cancelAfterFormCtrl.value && this.cancelafterTimeInput) {
      let datePicker2 = new Date(this.cancelAfterFormCtrl.value);
      this.cancelAfterDateTime = new Date(datePicker2.getFullYear() + "-" + ((datePicker2.getMonth()+1) < 10 ? "0":"")+(datePicker2.getMonth()+1) + "-" + datePicker2.getDate() + "T" + this.cancelafterTimeInput.trim());    
    }
    else
      this.cancelAfterDateTime = null;

    this.cancelDateInFuture = this.cancelAfterDateTime != null && this.cancelAfterDateTime.getTime() < Date.now();
    this.validCancelAfter = this.cancelAfterDateTime != null && this.cancelAfterDateTime.getTime() > 0;
    
    if(this.validCancelAfter && this.validFinishAfter)
      this.cancelDateBeforeFinishDate = this.finishAfterDateTime.getTime() >= this.cancelAfterDateTime.getTime();
    else
      this.cancelDateBeforeFinishDate = false;

    if(this.amountInput) {
      this.validAmount = !(/[^.0-9]|\d*\.\d{7,}/.test(this.amountInput));

      if(!this.validAmount) {
        this.maxSixDigits = this.amountInput.includes('.') && this.amountInput.split('.')[1].length > 6;
      } else {
        this.maxSixDigits = false;
      }
    }

    if(this.validAmount)
      this.validAmount = this.amountInput && parseFloat(this.amountInput) >= 0.000001 && !this.escrowBiggerThanAvailable();

    this.validAddress = this.destinationInput && this.destinationInput.trim().length > 0 && isValidXRPAddress(this.destinationInput.trim());

    this.validCondition = this.passwordInput && this.passwordInput.trim().length > 0;

    //check some fields first
    if(this.isFinishAfterDateSet() && !this.finishafterTimeInput)
      this.isValidEscrow = false;
    else
      this.isValidEscrow = true;

    if(this.finishafterTimeInput && !this.validFinishAfter)
      this.isValidEscrow = false;
    else
      this.isValidEscrow = true;

    if(this.isCancelAfterDateSet() && !this.cancelafterTimeInput)
      this.isValidEscrow = false;
    else
      this.isValidEscrow = true;

    if(this.isValidEscrow && this.cancelafterTimeInput && !this.validCancelAfter)
      this.isValidEscrow = false;

    if(this.isValidEscrow && this.validAmount && this.validAddress && (this.validFinishAfter || this.validCondition)) {
      if(this.validCondition)
        this.isValidEscrow = this.validFinishAfter || this.validCancelAfter
      else
        this.isValidEscrow = this.validFinishAfter 
    }
    else
      this.isValidEscrow = false;

    if(this.isValidEscrow && this.validFinishAfter && this.validCancelAfter) {
      this.isValidEscrow = !this.cancelDateBeforeFinishDate && !this.cancelDateInFuture && !this.finishDateInFuture;
    }

    //console.log("isValidEscrow: " + this.isValidEscrow);
  }

  isFinishAfterDateSet(): boolean {
    let date = new Date(this.finishAfterFormCtrl.value)
    return date != null && date.getTime() > 0;
  }

  isCancelAfterDateSet(): boolean {
    let date = new Date(this.cancelAfterFormCtrl.value)
    return date != null && date.getTime() > 0;
  }

  resetFinishAfter() {
    this.finishAfterFormCtrl.reset();
    this.finishafterTimeInput = null
  }

  resetCancelAfter() {
    this.cancelAfterFormCtrl.reset();
    this.cancelafterTimeInput = null
  }

  isValidDate(dateToParse: any): boolean {
    let datePicker = new Date(dateToParse);
    console.log(datePicker);
    return datePicker.getHours() >= 0;
  }

  handleDateAndTimeNonPicker(dateInput: string, timeInput: string): Date {
    let dateTime:Date = null;
    if(dateInput && dateInput.trim().length > 0)
      dateTime = new Date(dateInput.trim());
    else
      dateTime = null;

    if(timeInput && timeInput.trim().length > 0 && dateTime) {
      let splitValues:string[] = timeInput.trim().split(':');

      if(splitValues) {
        if(splitValues[0] && Number.isInteger(Number.parseInt(splitValues[0])))
          dateTime.setHours(Number.parseInt(splitValues[0]));

        if(splitValues[1] && Number.isInteger(Number.parseInt(splitValues[1])))
          dateTime.setMinutes(Number.parseInt(splitValues[1]));

        if(splitValues[2] && Number.isInteger(Number.parseInt(splitValues[2])))
          dateTime.setSeconds(Number.parseInt(splitValues[2]));
      }
    }

    return dateTime;
  }

  sendPayloadToXumm() {

    this.googleAnalytics.analyticsEventEmitter('escrow_create', 'sendToXumm', 'escrow_create_component');
    let xummPayload:XummTypes.XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "EscrowCreate"
      }, custom_meta: {
        instruction: ""
      }
    }

    if(this.escrowYears > 10) {
      xummPayload.custom_meta.instruction += "ATTENTION: Your XRP will be inaccessible for " + this.escrowYears + "years!\n\n";
    }

    if(this.destinationInput && this.destinationInput.trim().length>0 && isValidXRPAddress(this.destinationInput)) {
      xummPayload.txjson.Destination = this.destinationInput.trim();
      xummPayload.custom_meta.instruction += "- Escrow Destination: " + this.destinationInput.trim();
    }

    if(this.amountInput && parseFloat(this.amountInput) >= 0.000001) {
      xummPayload.txjson.Amount = parseFloat(this.amountInput)*1000000+"";
      xummPayload.custom_meta.instruction += "\n- Escrow Amount: " + this.amountInput;
    }
 
    if(this.validCancelAfter) {
      xummPayload.txjson.CancelAfter = normalizer.utcToRippleEpocheTime(this.cancelAfterDateTime.getTime());
      xummPayload.custom_meta.instruction += "\n- Cancel After (UTC): " + this.cancelAfterDateTime.toUTCString();
    }

    if(this.validFinishAfter) {
      xummPayload.txjson.FinishAfter = normalizer.utcToRippleEpocheTime(this.finishAfterDateTime.getTime());
      xummPayload.custom_meta.instruction += "\n- Finish After (UTC): " + this.finishAfterDateTime.toUTCString();
    }

    if(this.validCondition) {
      let fulfillment_bytes:Buffer = Buffer.from(this.passwordInput.trim(), 'utf-8');

      
      import('five-bells-condition').then( cryptoCondition => {
        let myFulfillment = new cryptoCondition.PreimageSha256();

        myFulfillment.setPreimage(fulfillment_bytes);

        let fulfillment = myFulfillment.serializeBinary().toString('hex').toUpperCase()
        //console.log('Fulfillment: ', fulfillment)
        //console.log('             ', myFulfillment.serializeUri())

        var condition = myFulfillment.getConditionBinary().toString('hex').toUpperCase()
        //console.log('Condition  : ', condition)
          // 'A0258020' + sha256(fulfillment_bytes) + '810102'
        //console.log('             ', myFulfillment.getCondition().serializeUri())

        //console.log()

        //console.log(
        //  'Fulfillment valid for Condition?      ',
        //    cryptoCondition.validateFulfillment(
        //    cryptoCondition.Fulfillment.fromBinary(Buffer.from(fulfillment, 'hex')).serializeUri(), 
        //    cryptoCondition.Condition.fromBinary(Buffer.from(condition, 'hex')).serializeUri()
        //  )
        //)

        xummPayload.txjson.Condition = condition
        xummPayload.custom_meta.instruction += "\n- With a password ✓"

        this.onPayload.emit(xummPayload);
      });      
    } else {
      this.onPayload.emit(xummPayload);
    }
  }

  getAvailableBalanceForEscrow(): number {
    if(this.originalAccountInfo && this.originalAccountInfo.Balance) {
      let balance:number = Number(this.originalAccountInfo.Balance);
      balance = balance - (20*1000000); //deduct acc reserve
      balance = balance - (this.originalAccountInfo.OwnerCount * 5 * 1000000); //deduct owner count
      balance = balance - 5 * 1000000; //deduct account reserve for escrow
      balance = balance/1000000;

      if(balance >= 0.000001)
        return balance
      else
        return 0;
      
    } else {
      return 0;
    }
  }

  escrowBiggerThanAvailable(): boolean {
    return this.originalAccountInfo && this.amountInput && parseFloat(this.amountInput) > this.getAvailableBalanceForEscrow();
  }

  clearInputs() {
    this.destinationInput = this.amountInput = null;
    this.finishAfterFormCtrl.reset();
    this.cancelAfterFormCtrl.reset();
    this.cancelafterTimeInput = this.cancelAfterDateTime = null;
    this.finishafterTimeInput = this.finishAfterDateTime = null;

    this.cancelDateInFuture =  this.finishDateInFuture = this.cancelDateBeforeFinishDate = false;

    this.isValidEscrow = this.validAddress = this.validAmount = this.validCancelAfter = this.validFinishAfter = this.validCondition = false;

    this.passwordInput = null;
  }
}
