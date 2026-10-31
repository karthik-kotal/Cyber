export interface ScamCategory {
  id: string;
  name: string;
  description: string;
}

export const SCAM_CATEGORIES: ScamCategory[] = [
  // Original 17 Categories
  { id: 'upi-refund-qr', name: 'UPI Refund QR', description: 'Scammer sends a collect request or QR code claiming it will credit money to you.' },
  { id: 'bank-fraud', name: 'Bank Fraud', description: 'Unauthorized bank debits, net banking account takeover, or card skim.' },
  { id: 'fake-kyc-link', name: 'Fake KYC Link', description: 'Phishing link urging urgent bank, SIM, or wallet KYC update to prevent blocking.' },
  { id: 'digital-arrest', name: 'Digital Arrest', description: 'Video call intimidation by fake law enforcement claiming illegal parcels or money laundering.' },
  { id: 'investment-group', name: 'Investment Group Scam', description: 'Fake WhatsApp/Telegram groups offering guaranteed astronomical returns on stocks or crypto.' },
  { id: 'courier-customs', name: 'Courier & Customs Parcel', description: 'Call or SMS stating a parcel contains contraband and demanding clearance penalties.' },
  { id: 'job-offer', name: 'Job / Task Scam', description: 'Part-time rating, YouTube liking, or typing jobs requiring upfront security deposits.' },
  { id: 'lottery-prize', name: 'Lottery / Prize Fraud', description: 'Fake notifications claiming a big lottery win requiring advance processing fees.' },
  { id: 'loan-app-harassment', name: 'Predatory Loan App', description: 'Illegal instant loan apps that harvest phone contacts and extort users.' },
  { id: 'electricity-disconnection', name: 'Electricity Disconnection', description: 'Urgent SMS claiming power will be cut tonight unless you call a fake officer.' },
  { id: 'fake-customer-care', name: 'Fake Customer Care', description: 'Scam helpline numbers planted on search engines pretending to be bank or airline support.' },
  { id: 'otp-call', name: 'OTP Harvesting Call', description: 'Callers pretending to be bank staff tricking victims into revealing one-time passwords.' },
  { id: 'sextortion', name: 'Sextortion / Video Call Blackmail', description: 'Unsolicited video call followed by morphed footage and extortion threats.' },
  { id: 'whatsapp-scam', name: 'WhatsApp Scam', description: 'Scam messages, links, or impersonation attempts received via WhatsApp.' },
  { id: 'phone-scam', name: 'Phone Call Scam', description: 'Fraudulent phone calls claiming emergency, legal action, or fake service issues.' },
  { id: 'sms-fraud', name: 'SMS Fraud', description: 'Smishing messages containing deceptive links or urgent malicious instructions.' },
  { id: 'phishing', name: 'Phishing', description: 'Deceptive websites or messages crafted to harvest login credentials and sensitive data.' },

  // 28 New Categories
  { id: 'bank-account-freeze', name: 'Bank Account Freeze', description: 'Fake bank message claiming your account will be blocked unless you verify details' },
  { id: 'credit-card-fraud', name: 'Credit Card Fraud', description: 'Fake credit card offers or messages asking for card details' },
  { id: 'upi-collect-request', name: 'UPI Collect Request', description: 'Fraudulent UPI collect request asking you to approve a payment' },
  { id: 'screen-sharing-scam', name: 'Screen Sharing Scam', description: 'Scammer asks you to install an app or share your screen to steal banking information' },
  { id: 'remote-access-scam', name: 'Remote Access Scam', description: 'Fake support agent asks you to install remote access software' },
  { id: 'fake-police-notice', name: 'Fake Police Notice', description: 'Fake police or government notice demanding money to avoid legal action' },
  { id: 'social-media-hack', name: 'Social Media Hack', description: 'Fake account recovery message or link used to steal social media credentials' },
  { id: 'account-takeover', name: 'Account Takeover', description: 'Scammer steals login credentials to access and control an account' },
  { id: 'sim-swap', name: 'SIM Swap', description: 'Fraudster obtains control of your phone number to intercept OTPs' },
  { id: 'phishing-email', name: 'Phishing Email', description: 'Fraudulent email designed to steal passwords, banking details, or personal information' },
  { id: 'sms-phishing', name: 'SMS Phishing', description: 'Fake SMS containing malicious links or requests for sensitive information' },
  { id: 'fake-charity', name: 'Fake Charity', description: 'Fraudulent donation request pretending to support a charity or emergency' },
  { id: 'insurance-scam', name: 'Insurance Scam', description: 'Fake insurance policy, claim, or renewal message demanding payment' },
  { id: 'property-scam', name: 'Property Scam', description: 'Fake rental or property listing asking for advance payment' },
  { id: 'travel-booking-scam', name: 'Travel Booking Scam', description: 'Fake hotel, flight, or travel booking asking for payment' },
  { id: 'crypto-investment', name: 'Crypto Investment', description: 'Fake cryptocurrency investment promising guaranteed profits' },
  { id: 'deepfake-scam', name: 'Deepfake Scam', description: 'AI-generated voice or video impersonation used to deceive victims' },
  { id: 'relationship-scam', name: 'Relationship Scam', description: 'Fake online relationship used to manipulate victims into sending money' },
  { id: 'impersonation-scam', name: 'Impersonation Scam', description: 'Scammer pretends to be a family member, friend, or trusted person asking for money' },
  { id: 'fake-government-scheme', name: 'Fake Government Scheme', description: 'Fake government benefit, subsidy, or registration scheme asking for fees or personal details' },
  { id: 'website-spoofing', name: 'Website Spoofing', description: 'Fake website designed to look like a legitimate bank, company, or government portal' },
  { id: 'qr-payment-scam', name: 'QR Payment Scam', description: 'Fake payment QR code used to redirect payments to a scammer' },
  { id: 'business-email-compromise', name: 'Business Email Compromise', description: 'Fraudulent business email impersonating an employee or vendor to request payments' },
  { id: 'refund-scam', name: 'Refund Scam', description: 'Fake refund message or call asking for banking details or payment approval' },
  { id: 'delivery-fee-scam', name: 'Delivery Fee Scam', description: 'Fake delivery message demanding a small payment to release a parcel' },
  { id: 'fake-support-scam', name: 'Fake Support Scam', description: 'Fake technical support agent claiming your device or account has a problem' },
  { id: 'data-theft', name: 'Data Theft', description: 'Scam designed to collect personal, financial, or identity information' },
  { id: 'identity-theft', name: 'Identity Theft', description: 'Stolen personal information used to impersonate someone or open accounts' },
];

