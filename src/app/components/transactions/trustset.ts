import { Component, ViewChild, Output, EventEmitter, Input, OnInit, OnDestroy, ElementRef, AfterViewInit } from '@angular/core';
import { Observable, Subscription, Subject } from 'rxjs';
import { XummTypes } from 'xumm-sdk';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AccountInfoChanged, XrplAccountChanged, Token, TrustLine } from 'src/app/utils/types';
import * as normalizer from '../../utils/normalizers';
import { ActivatedRoute } from '@angular/router';
import { MatExpansionPanel } from '@angular/material/expansion';
import { isValidXRPAddress } from 'src/app/utils/utils';

@Component({
  selector: 'trustset',
  templateUrl: './trustset.html'
})
export class TrustSetComponent implements OnInit, OnDestroy, AfterViewInit {

  private TRUST_SET_FLAG_SET_NO_RIPPLE:number = 131072;
  private TRUST_SET_FLAG_CLEAR_NO_RIPPLE:number = 262144;
  private TRUST_SET_FLAG_SET_FREEZE:number = 1048576;
  private TRUST_SET_FLAG_CLEAR_FREEZE:number = 2097152;

  constructor(private route: ActivatedRoute,private googleAnalytics: GoogleAnalyticsService) { }

  @Input()
  accountInfoChanged: Observable<AccountInfoChanged>;

  @Input()
  transactionSuccessfull: Observable<any>;
  
  @Output()
  onPayload: EventEmitter<XummTypes.XummPostPayloadBodyJson> = new EventEmitter();

  @ViewChild('inpisseraccount') inpisseraccount;
  issuerAccountInput: string;

  @ViewChild('inplimit') inplimit;
  limitInput: string;

  @ViewChild('mep') mep: MatExpansionPanel

  issuedCurrencyInput: string;

  maxFifthteenDigits:boolean = false;

  originalAccountInfo:any;
  testMode:boolean = false;

  private accountInfoChangedSubscription: Subscription;
  private transactionSuccessfullSubscription: Subscription;
  issuerAccountChangedSubject: Subject<XrplAccountChanged> = new Subject<XrplAccountChanged>();
  xrplAccountInfoChangedSubject: Subject<AccountInfoChanged> = new Subject<AccountInfoChanged>();

  showIssuedCurrencySelectedStyle:boolean = false;
  issuedCurrencySelected:boolean = false;
  
  isValidTrustSet:boolean = false;
  validAddress:boolean = false;
  validCurrency:boolean = false;
  validLimit:boolean = false;

  lastKnownAddress:string = null;
  lastKnownCurrency:string = null;

  isEditMode:boolean = false;

  ngOnInit() {
    this.accountInfoChangedSubscription = this.accountInfoChanged.subscribe(accountData => {
      //console.log("account info changed received: " + JSON.stringify(accountData));
      this.originalAccountInfo = accountData.info;
      this.testMode = accountData.mode;

      this.xrplAccountInfoChangedSubject.next(accountData);
      
      setTimeout(() => {
        this.issuerAccountChangedSubject.next({account: this.lastKnownAddress, mode: this.testMode});
      },500);
    });

    this.transactionSuccessfullSubscription = this.transactionSuccessfull.subscribe(() => {
      this.clearInputs()
    });

    this.route.queryParams.subscribe(async params => {
      if(params.issuer && params.currency && params.limit) {
        this.issuerAccountInput = params.issuer;
        //console.log("subscribe received: " + params.currency);
        this.issuedCurrencyInput = normalizer.currencyCodeUTF8ToHexIfUTF8(params.currency);
        //console.log("subscribe set: " + this.issuedCurrencyInput);
        this.limitInput = params.limit;

        this.checkChanges();
      }
    });
  }

  ngAfterViewInit() {
    if(this.isValidTrustSet) {
      setTimeout(() => {
        this.mep.open();
        this.sendPayloadToXumm()
      });
    }
  }

  ngOnDestroy() {
    if(this.accountInfoChangedSubscription)
      this.accountInfoChangedSubscription.unsubscribe();

    if(this.transactionSuccessfullSubscription)
      this.transactionSuccessfullSubscription.unsubscribe();

    if(this.xrplAccountInfoChangedSubject)
      this.xrplAccountInfoChangedSubject.unsubscribe();

    if(this.issuerAccountChangedSubject)
      this.issuerAccountChangedSubject.unsubscribe();
  }

  sendPayloadToXumm() {

    //console.log("sendPayloadToXumm: " + this.issuedCurrencyInput);

    this.googleAnalytics.analyticsEventEmitter('trust_set', 'sendToXumm', 'trust_set_component');

    let payload:XummTypes.XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "TrustSet",
        Flags: this.TRUST_SET_FLAG_SET_NO_RIPPLE
      }
    }

    payload.txjson.LimitAmount = {};
    payload.custom_meta = {};

    if(this.issuerAccountInput && this.issuerAccountInput.trim().length>0 && this.validAddress) {
      payload.txjson.LimitAmount['issuer'] = this.issuerAccountInput.trim();
      payload.custom_meta.instruction = "- Issuer Address: " +this.issuerAccountInput.trim();
    }

    if(this.issuedCurrencyInput && this.validCurrency) {
      let currencyCode = this.issuedCurrencyInput;
      if(currencyCode.length > 3) {
        while(currencyCode.length < 40)
          currencyCode+="0";
      }
      payload.txjson.LimitAmount['currency'] = currencyCode.toUpperCase();
      payload.custom_meta.instruction += "\n- Token currency code: " + this.currencyCodeAsAscii;
    }

    if(this.limitInput && this.validLimit) {
      payload.txjson.LimitAmount['value'] = normalizer.tokenNormalizer(this.limitInput.trim());
      payload.custom_meta.instruction += "\n- Limit: " + this.limitInput.trim();
    }

    this.onPayload.emit(payload);
  }

  issuerAccountChanged() {
    //console.log("issuerAccountChanged: " + this.issuedCurrencyInput);
    this.checkChanges();

    if(this.validAddress && (this.issuerAccountInput.trim() != this.lastKnownAddress)) {
      this.lastKnownAddress = this.issuerAccountInput.trim();
      //console.log("emitting issuerAccountChanged event");
      this.issuerAccountChangedSubject.next({account: this.lastKnownAddress, mode: this.testMode});
    } else if(!this.validAddress) {
      this.lastKnownAddress = null;
      this.issuerAccountChangedSubject.next({account: this.lastKnownAddress, mode: this.testMode});
    }
  }

  currencyChanged() {
    this.checkChanges();

    if(!this.validCurrency && this.lastKnownCurrency && this.validAddress) {
      //currency changed
      //console.log("send currency changed");
      this.issuerAccountChangedSubject.next({account: this.issuerAccountInput.trim(), mode: this.testMode});
    }

    //console.log("currencyChanged: " + this.issuedCurrencyInput);

  }

  checkChanges() {
    //console.log("amountInput: " + this.amountInput);
    //console.log("destinationInput: " + this.destinationInput);
    //console.log(this.issuerAccountInput);

    this.validCurrency = this.issuedCurrencyInput && this.issuedCurrencyInput.trim().length >= 3 && this.issuedCurrencyInput.length <= 40;
    this.validAddress = this.issuerAccountInput && this.issuerAccountInput.trim().length > 0 && isValidXRPAddress(this.issuerAccountInput.trim());

    if(this.validCurrency) {
      if((!this.lastKnownCurrency || this.lastKnownCurrency.trim().length == 0 ) && (!this.limitInput || this.limitInput.trim().length == 0))
        this.limitInput = "1000000";
    }

    this.lastKnownCurrency = this.issuedCurrencyInput;

    
    if(this.limitInput) {

      if(!this.limitInput.includes("e")) {
        this.validLimit = !(/[^.0-9]|\d*\.\d{16,}/.test(this.limitInput));

        if(!this.validLimit) {
          this.maxFifthteenDigits = this.limitInput.includes('.') && this.limitInput.split('.')[1].length > 15;
        } else {
          this.maxFifthteenDigits = false;
        }
      } else {
        //console.log("checking scientific notation");
        try {
          console.log("string first: " + this.limitInput.substring(0, this.limitInput.indexOf('e')))
          console.log("string second: " + this.limitInput.substring(this.limitInput.indexOf('e')+1))

          let first:number = Number(this.limitInput.substring(0, this.limitInput.indexOf('e')));
          let second:number = Number(this.limitInput.substring(this.limitInput.indexOf('e')+1));

          console.log("first: " + first);
          console.log("second: " + second);

          if(!Number.isNaN(first) && Number.isInteger(second)) {
            this.validLimit = first > 0 && first <= 9999999999999999 && second >= -96 && second <= 80
          } else {
            this.validLimit = false;
          }
        } catch(err) {
          this.validLimit = false;
        }
      }
    }

    console.log("is valid limit: " + this.validLimit);

    if(this.validLimit)
      this.validLimit = this.limitInput && parseFloat(this.limitInput) >= 0;

    this.isValidTrustSet = this.validAddress && this.validCurrency && this.validLimit;

    this.issuedCurrencySelected = false;


    //console.log("isValidTrustSet: " + this.isValidTrustSet);
    //console.log("checkChanges: " + this.issuedCurrencyInput);
  }

  clearInputs() {
    this.issuerAccountInput = this.issuedCurrencyInput = this.limitInput = null;
    this.isValidTrustSet = this.validAddress = this.validCurrency = this.validLimit = false;
    this.lastKnownAddress = null;
    this.isEditMode = false;
    
    this.issuerAccountChangedSubject.next({account: null, mode: this.testMode});
  }

  onTrustLineEdit(trustline:TrustLine) {
    this.isEditMode = true;
    this.issuerAccountInput = trustline.account;
    this.issuedCurrencyInput = trustline.currency;
    this.limitInput = trustline.limit;
    //console.log("onTrustLineEdit: " + this.issuedCurrencyInput);
    this.checkChanges();
  }

  onDisableRippling(trustline:TrustLine) {
    //console.log("onDisableRippling");
    //console.log("onDisableRippling: " + this.issuedCurrencyInput);
    this.googleAnalytics.analyticsEventEmitter('trust_set', 'onDisableRippling', 'trust_set_component');

    let payload:XummTypes.XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "TrustSet",
        Flags: this.TRUST_SET_FLAG_SET_NO_RIPPLE
      }
    }

    payload.txjson.LimitAmount = {};
    payload.custom_meta = {
      instruction: "Set 'NoRipple' Flag on this TrustLine\n\n"
    };

    payload.txjson.LimitAmount['issuer'] = trustline.account;
    payload.custom_meta.instruction += "- Counterparty: " + trustline.account;

    let currencyCode = trustline.currency;
    let humanReadableCode = normalizer.normalizeCurrencyCodeXummImpl(trustline.currency);
    if(currencyCode.length > 3) {
      while(currencyCode.length < 40)
        currencyCode+="0";
    }
    payload.txjson.LimitAmount['currency'] = currencyCode;
    payload.custom_meta.instruction += "\n- Token currency code: " + humanReadableCode;

    payload.txjson.LimitAmount['value'] = trustline.limit
    payload.custom_meta.instruction += "\n- Limit: " + trustline.limit;

    payload.custom_meta.instruction += "\n- Disable Rippling: true";

    this.onPayload.emit(payload);
  }

  onIssuedCurrencyFound(token:Token) {

    this.issuedCurrencyInput = token.currency;
    this.limitInput = token.amount;

    //console.log("onIssuedCurrencyFound: " + this.issuedCurrencyInput);

    this.checkChanges();

    this.issuedCurrencySelected = true;

    this.showIssuedCurrencySelectedStyle = true;
    setTimeout(() => this.showIssuedCurrencySelectedStyle = false, 1000);
  }

  deleteTrustLine(trustline: TrustLine) {
    //console.log("deleteTrustLine: " + this.issuedCurrencyInput);
    this.googleAnalytics.analyticsEventEmitter('trust_set', 'deleteTrustLine', 'trust_set_component');

    let payload:XummTypes.XummPostPayloadBodyJson = {
      txjson: {
        TransactionType: "TrustSet",
        Flags: this.TRUST_SET_FLAG_SET_NO_RIPPLE
      }
    }

    payload.txjson.LimitAmount = {};
    payload.custom_meta = {
      instruction: "Deleting TrustLine\n\n"
    };

    payload.txjson.LimitAmount['issuer'] = trustline.account;
    payload.custom_meta.instruction += "- Counterparty: " + trustline.account;

    let currencyCode = trustline.currency;
    let humenReadableCode = normalizer.normalizeCurrencyCodeXummImpl(trustline.currency);
    if(currencyCode.length > 3) {
      while(currencyCode.length < 40)
        currencyCode+="0";
    }
    payload.txjson.LimitAmount['currency'] = currencyCode;
    payload.custom_meta.instruction += "\n- Token currency code: " + humenReadableCode;

    payload.txjson.LimitAmount['value'] = "0"
    payload.custom_meta.instruction += "\n- Limit: 0";

    this.onPayload.emit(payload);
  }

  cancelEdit() {
    this.issuerAccountInput = this.limitInput = this.issuedCurrencyInput = null;
    this.checkChanges();
    this.isEditMode = false;
  }

  get currencyCodeAsAscii() {
    return normalizer.normalizeCurrencyCodeXummImpl(this.issuedCurrencyInput);
  }

  set currencyCodeAsAscii(currency: string) {
    this.issuedCurrencyInput = normalizer.currencyCodeUTF8ToHex(currency);
  }

}
