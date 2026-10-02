FAH Brand Validation Website
=============================

This package keeps the FAH story/product interface and replaces the old e-commerce flow with:

1. Name + mobile
2. Quantity
3. Price + CGST/SGST/IGST from Admin
4. UPI deep-link payment using:
   upi://pay?pa=UPI_ID&pn=RECEIVER_NAME&cu=INR
5. Customer returns and enters payment time
6. Customer submission is stored in Supabase as "Customer Reported Paid"
7. Feedback + Instagram campaign choices
8. Optional creative-post proof URL
9. Admin dashboard, duplicate flagging, analytics and CSV export

IMPORTANT
--------
The website does NOT automatically verify a bank/UPI payment. The UPI link simply asks the phone to open its available UPI app. The customer reports the payment time after returning.

SETUP
-----
1. Create/open your Supabase project.
2. In Supabase SQL Editor, run setup.sql.
3. In config.js replace:
   PASTE_YOUR_SUPABASE_PROJECT_URL_HERE
   PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE
4. In Supabase Authentication, create the admin user you want to use.
5. Open admin-login.html and sign in.
6. Configure price, tax, UPI ID, receiver name, Instagram URL, feedback URL and campaign text.
7. Upload the whole folder to GitHub Pages.

SECURITY
--------
- Do not put a Supabase service-role key in config.js.
- The customer page can read only the settings row.
- Anonymous users can INSERT customer submissions.
- Only authenticated users can read/update customer submissions.
- For a production deployment with more than one admin, restrict authenticated policies to the intended admin user(s).

FILES
-----
index.html
admin-login.html
admin.html
config.js
script.js
admin.js
style.css
setup.sql
contact.html
privacy-policy.html
refund-policy.html
shipping-policy.html
terms.html
fah-logo.png
pack-front.jpg


PAYMENT UX UPDATE
-----------------
The customer now gets a payment popup with BOTH:
1. Pay with UPI App — opens the configured upi://pay deep link.
2. Scan & Pay — generates a fresh QR for the exact checkout total. The QR encodes the amount and has FAH + the amount branded in the QR center.

The generated QR keeps the existing download flow. On the page it remains visually protected; the customer downloads the clear generated QR and can use the UPI app gallery/photo scanner when supported. Gallery scanning is not universal.

The popup gives clear instructions to verify the receiver and amount and never enter a UPI PIN/OTP on the FAH website.


Campaign update:
- Admin > Feedback Form URL: paste your Google Form/feedback-sheet link.
- Customer thank-you screen shows Fill Feedback Form + Follow FAH on Instagram.
- Customer campaign confirmation now has only two choices: YES (feedback + Instagram + social promotion) or SORRY DUDE, NEXT TIME.
- The YES choice is saved for admin verification; no customer proof-upload field is required.
- Each campaign record stores the receiver UPI ID actually used by the customer payment link at submission time, and Admin shows it as "Receiver UPI ID Used".
