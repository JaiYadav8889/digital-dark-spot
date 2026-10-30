-- =============================================================================
-- CSSS demonstration dataset — GENERATED, do not hand-edit.
--
-- Produced by: node scripts/build-demo-dataset.mjs
-- Generated at: 2026-10-30T18:06:58.039Z
--
-- Every page of text, chunk boundary, excerpt, requirement status, finding and
-- checklist item below was computed from the uploaded PDFs by the project's own
-- extraction and analysis code. No expected finding is written into this file.
-- Regenerate rather than edit.
-- =============================================================================

delete from public.research_sessions where id = '00000000-0000-4000-8000-000000000001';

insert into public.research_sessions
  (id, title, question, context, target_cycle, domain, status, analysis_engine, analysis_error, owner_id, is_demo, last_analysed_at, analysis_meta, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000000001',
  'CSSS scholarship — what must be verified for AY 2026–27?',
  'What should a student verify before relying on the Central Sector Scheme of Scholarships (CSSS) information for AY 2026–27?',
  'Two official documents were supplied: the MHRD/Department of Higher Education scheme guidelines and the Department of Higher Education CSSS FAQ. The question is not what the scheme says in general, but which details these documents actually establish for AY 2026–27 and which must be confirmed with the ministry, the institute or the state nodal agency before an application is made.',
  'AY 2026–27',
  'Education · Scholarship',
  'ready', 'heuristic',
  'Analysis ran on the uploaded documents with the heuristic engine: GEMINI_API_KEY is not configured, so no model call was made. Findings are rule-based signals from the extracted text, not AI conclusions.',
  null, true, now(),
  '{"dataset":"source-driven","source_files":2,"generated_by":"scripts/build-demo-dataset.mjs"}'::jsonb,
  now(), now()
);

-- ------------------------------------------------------------------ sources (from the uploads)
insert into public.sources
  (id, session_id, kind, title, url, domain, issuer, source_type, storage_path, document_path, file_name, file_size, mime_type, page_count, published_date, updated_date, retrieved_at, status, extractor, extraction_notes, error_message, char_count, created_at, updated_at)
values
  ('00000000-0000-4000-8000-001100000001', '00000000-0000-4000-8000-000000000001', 'pdf', 'Central Sector Scheme of Scholarship for College and University Students — Scheme Guidelines (MHRD / Department of Higher Education)', 'https://scholarships.gov.in/public/schemeGuidelines/CSSS_GUIDLINES_06022024.pdf', 'uploaded document', 'Ministry of Human Resource Development, Department of Higher Education (Scholarship Bureau)', 'official_guideline', null, '/demo-sources/csss-guidelines-mhrd.pdf', 'GuidlineMHRDCentralSectorSchiolarship.pdf', 721692, 'application/pdf', 7, '2018-08-03', null, now(), 'extracted', 'pymupdf', 'Uploaded demonstration document (Phase 1 inventory pack) Original filename: GuidlineMHRDCentralSectorSchiolarship.pdf. Content hash (sha256): f5ed1a2ff37cb7f2dfb6b42fbe94a3f6b01347fd6d27d3bf7fc7d7f4f89c0780. Date basis: PDF creation-date metadata (Adobe Paper Capture, 3 Aug 2018). The document itself is dated AUGUST, 2018. Text quality: The text layer is OCR output from a scanned paper capture: figures and words are mis-read in places (“80111 percentile” for 80th percentile, “Income Cenificate”, “Rs.I0000”). Numbers quoted from this file should be read against the page image before use. URL recorded in the Phase 1 research inventory for the CSSS guidelines PDF. It was NOT re-fetched during this import; the text below comes from the uploaded file.', null, 10225, now(), now()),
  ('00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000000001', 'pdf', 'PM-USP Central Sector Scheme of Scholarships — Frequently Asked Questions (DOHE, 2025-26)', null, 'uploaded document', 'Department of Higher Education (Scholarship Division), Ministry of Education', 'pdf_document', null, '/demo-sources/csss-faq-dohe.pdf', 'FAQ_DOHE_CSSS.pdf', 329156, 'application/pdf', 8, '2025-06-18', null, now(), 'extracted', 'pymupdf', 'Uploaded demonstration document (Phase 1 inventory pack) Original filename: FAQ_DOHE_CSSS.pdf. Content hash (sha256): 6f45193573e170b603e05d76ac671f8c0a2d299b4a46e8dc841cfab7761ac4eb. Date basis: PDF creation-date metadata (Word export, 18 Jun 2025). No publication date is printed on the document itself. Text quality: Digital text, no OCR noise. The FAQ answers are written for AY 2025-26 and carry no explicit calendar deadline, so it cannot settle a 2026-27 date. No original URL is recorded in the Phase 1 inventory for this FAQ (the inventory lists the official FAQ URL as unconfirmed). None is invented here; the document is opened from the uploaded copy.', null, 19633, now(), now());

-- ------------------------------------------------------------------ chunks (page-preserving)
insert into public.source_chunks (id, source_id, session_id, chunk_index, content, char_count, page_from, page_to, created_at)
values
  ('00000000-0000-4000-8000-000000002000', '00000000-0000-4000-8000-001100000001', '00000000-0000-4000-8000-000000000001', 0, 'Government of India
Ministry ofHuman Resource Development
Department ofHigher Education
(Scholarship Bureau)
GUIDELINES
CENTRAL SECTOR SCHEME OF SCHOLARSHIP FOR COLLEGE
AND
UNIVERSITY STUDENTS
AUGUST, 2018', 205, 1, 1, now()),
  ('00000000-0000-4000-8000-000000002001', '00000000-0000-4000-8000-001100000001', '00000000-0000-4000-8000-000000000001', 1, 'Department of Higher Education
Scholarship Burea u
(National Scholarship Division)
GUIDELINES
FOR
THE
CENTRAL
SECTOR
SCHEME
OF
SCHOLARSHIP FOR COLLEGE AND UNIVERSITY STUDENTS
1.
OBJECTIVE:
To provide financial assistance to meritorious students from low income families
to meet a part oftheir day-to-day expenses while pursuing higher studies.
2.
SCOPE:
The scholarships are awarded on the basis of the results of Senior Secondary
Examination. 82000 fresh scholarships per annum [41000 for boys and 41000 for
girls) are awarded for pursuing graduate I postgraduate studies in colleges and
universities and for professional courses, such as Medical, Engineering etc.
3.
ALLOCATION OF SCHOLARSHIPS:
The total number ofscholarships are divided amongst the State Education Boards
based on the State''s population in the age group of 18-25 years, after segregating
share of CBSE and JCSE on the basis of number of students passing out from
various Boards in the country. 50 % of the scholarship is earmarked for girls.
The number of scholarships allotted to a State Education Board is dbtributed
amongst pass outs of the Science, Commerce and Humanities streams in the ratio
of 3:2:1. In case of shortfall in the number of applications, the scholarship slots
could be inter-changed.
4.
ELIGIBILITY
Students who are above 80111 percentile of successful candidates in the relevant
stream from the respective Board of Examination in Class XII of 10+2 pattern
or equivalent and pursuing regular courses (not correspondence or distance
mode) in Colleges/Institutions recognized by All India Council of Technical
Education, UGC Act, 1956, Medical Council of India, Dental Council of India
and respective regulatory authorities and not availing benefit of any other
scholarship scheme including State run scholarship schemes/Fee waiver and', 1826, 2, 2, now()),
  ('00000000-0000-4000-8000-000000002002', '00000000-0000-4000-8000-001100000001', '00000000-0000-4000-8000-000000000001', 2, '-2
reimbursement scheme are
eligible under the scheme. Students pursuing
Diploma courses are not eligible under the scheme.
S.
RESERVATION
Students belonging lo reserved categories/weaker sections /minorities are eligible
on the basis of merit, subject to Central Reservation Policy and internal
eannarking. Reservations for the various categories are as follows : Scheduled
Castes (SCs) 15 % , Scheduled Tribes ( STs) 7.5 %, Other Back\,ard
Classes(OBCs) 27 % and horizontally
5 % for Physically Handicapped I
Persons(s) with Disabilities (PwDs) in all the categories.
6.
ANNOUNCEMENT OF THE SCHEME AND SELECTION
PROCEDURE
I)
National Scholarship Ponal (NSP) www.scholarships.gov.in will be
opened for online application in the month ofJune-July every year.
2)
Class XII pass out students of the current Academic Year, who are above
80m percentile of the respective State Education Boards (SEBs) are
eligible under the scheme and can apply on National Scholarship Portal
(www.scholarship.2ov.in), before the cut-olT date.
Physical application
would not be accepted.
3)
The online applications would be verified at two levels:
(i) By the Institute where the student is studying.
(ii) By the respective State Education Board.
4)
Applicant is required to submit requisite documents, such as [ Class 12"''
mark sheet, Income Cenificate] to the Institute.
5)
Application which is not verified either by the institute or by the concerned
State Education Board or by both will be treated as ''Invalid''.
6)
Merit list as per the State allocated quota would be generated from the
verified applications.', 1592, 3, 3, now()),
  ('00000000-0000-4000-8000-000000002003', '00000000-0000-4000-8000-001100000001', '00000000-0000-4000-8000-000000000001', 3, '-3
7.
RATE OF SCHOLARSIDPS:
The rate ofscholarship is Rs.I0000/-per annum at Graduation level for first three
years of College and University courses and Rs.20000/- per annum at Post
Graduation level. Students pursuing professional courses, in case, where the
duration of course is five (5) years/Integrated course would get Rs.20000/- per
annum in the 4lh and 5lh year. However, students pursuing technical courses such
as B.Tech., B.Engg would get scholarship up to graduation level.
8.
PARENTAL INCOME CEILING:
The parental/family income ceiling is Rs. 8 lakh per annum for all categories
under the scheme and would be applicable from the Academic Session 2018-19.
Income certificate would be required for the fresh applicants only.
9.
DURATION OF SCHOLARSIDPS AND ITS RENEWAL
A student will be eligible for the scholarship for a total duration not exceeding S
years. A scholarship under the scheme is renewable on year to year basis up to
Post Graduate level in the same stream (except for the students pursuing technical
courses leading to degree at graduation level).
Ifa scholar is unable to appear in the annual exan1ination owing to illness and or
on account of any unforeseen event, the award may be renewed for the next
academic year on submission of medical cenificate and other proof to satisfy the
Head of the Institution who will certify that the student would have passed with
required percentage of marks or equivalent Grade Point Average, had he/she
appeared in the examination.
A scholar would be allowed to continue/renew his/her scholarship if, he/she
changes the course of study to a stream not offered by his school Board in Class
XTI (e.g. Law, Fashion Technology, etc.).
Students changing their
college/institute of study would be allowed to continue/renew the scholarship
provided the course ofstudy and the institution is recognized.
10.
For receiving scholarship benefit under Central Sector Scheme of
Scholarship for College Wld University Students, an individual shall furnish
proof ofpossession ofAadhaar or undergo Aadhaar authentication. Till the time
Aadhaar is assigned to the individual, following alternative identifiers can be
used:-
·', 2173, 4, 4, now()),
  ('00000000-0000-4000-8000-000000002004', '00000000-0000-4000-8000-001100000001', '00000000-0000-4000-8000-000000000001', 4, 'r
-4
(i)
Aadhaar Enrolment ID slip
(ii) Application made for Aadhaar enrolment
(iii) Voter identity card
(iv) Pennanent Account Number
(v) Passport
(vi) Driving License
(vii) Certificate of identity having photo of such member issued by a Gazetted
Officer or a Tehsildar on an official letter head; (viii)
Identity Card
issued by the college or institute or university.
(viii) Any other document with photo specified by the State Government:
Further, the students are required to have the bank accounts opened, especially, in
their name for availing the benefits under the scheme. The scholarship will be
disbursed directly into the bank accounts of the beneficiaries through Direct
Benefit Transfer (OBT) mode. The student can track their payment status from
the template " Know Your Payment" in the Public Financial Management
System (PFMS) portal [ https://pfms.nic.in/Users/LoginDetails/Login.aspx) either
by indicating Aadhaar number or bank account number.
11.
PROCEDURE FOR RENEWAL OF SCHOLARSHIP
For students of Academic Year 2008-09 to 2014-15 (up to 3rd renewal)
Students who have passed Class XII in the Academic Year 2008-09 to 2014-15
(up to 3n1 renewal) are required to obtain the renewal application blank fonn
from the respective State Education Boards and submit the same duly certified
from their respective institutions which is required to certify:
(a)
that the student has secured 60 o/o or more marks in the previous exam,
(b)
that the student has 75 % attendance and
(c)
that the student is not involved in any ragging activities.
For students ofAcademic Year 2014-15 (4''h renewal) (Offiine)
Students who have passed Class XII and have received fresh/renewal scholarship
through the
State Education Board concerned, are required to obtain the
renewal application blank fonn from the respective State Education Boards and
submit the same duly certified from their respective institutions
which is
required to certify:', 1939, 5, 5, now()),
  ('00000000-0000-4000-8000-000000002005', '00000000-0000-4000-8000-001100000001', '00000000-0000-4000-8000-000000000001', 5, '••••••
.5.
(a) that the student has secured 50 % or more marks in the previous exam
(b) that the student has 75 % attendance and
(c ) that the student is not involved in any ragging activities.
For students of Academic Year 2015 and onwards through National
Scholarship Portal
~
Students who have passed Class XIl and have received fresh/renewal scholarship
through the National Scholarship Portal (NSP) must apply online in the National
Scholarship Portal (www.scholarships.gov.in) for the renewal scholarships. The
50 %
and above criteria will be applicable prospectively i.e. for renewals
becoming due from 2018-19 onwards.
Renewal applications sent directly to the Ministry of Human Resource
Development shall not be accepted.
In case ofany grievances/complaint regarding the above scheme the same may be
registered to the following link http://pgportal.gov .in/grievancenew.aspx
Contact us:
National Scholarship Division,
Ministry ofHuman Resource Development, Department ofHigher Education,
West Block I, 2"d Floor, Wing 6, Room No. 6,
R K. Puram, Sector l, New Delhi 110066.
Tele: 011-26172917, 26172491, 26165238', 1120, 6, 6, now()),
  ('00000000-0000-4000-8000-000000002006', '00000000-0000-4000-8000-001100000001', '00000000-0000-4000-8000-000000000001', 6, '••••••
-
6
Number of Scholanblps allocated to States/UTs under the
Central Sector Scbeme of Scbolanbip for University and College
Students
s.
State
Quota (per year)
No.
I
CBSE
5413
2
!CSE
577
3
Andhra Pradesh •
3527
4
Arunachal Pradesh
77
5
Assam
2002
6
Bihar
5624
7
Chattisgarh
1387
8
Delhi
11 62
9
Goa
113
10
Gujarat
3944
11
Haryana
1591
12
Himachal Pradesh
461
13 .
Jammu & Kashmir
768
14
Jharkhand
1878
15
Kamataka
4237
16
Kera la
2324
17
Maharashtra
7417
18
Madhya Pradesh
4299
19
Manipur
181
20
Meghalaya
166
21
Mizoram
75
22
Nagaland
176
23
Odisha
2736
24
Punjab
1902
25
Rajasthan
3978
26
Sikkim
44
27
Tami l Nadu
4883
28
Telangana •
2570
29
Tripura
236
30
Uttar Pradesh
11 460
31
Unarakhand
61 6
32
West Bengal
5941
33
Andaman & Nicobar
31
34
Chandigarh
82
35
Dadra & Nagar Haveli
21
36
Daman&Diu
19
-
37
Lakshadweep
4
38
Puducherry
78
Total:
82000
• Note: - Bifurcation of Quota of unilied State of
Andbra Pradesh (6097) divided between the new State of
Telancana (2570) and Aadbra Pradesh (3527) vide len er no.
1-4212014-NS-I lAP) dated 17.09.2014 .', 1060, 7, 7, now()),
  ('00000000-0000-4000-8000-000000002100', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000000001', 0, 'Government of India
Ministry of Education
Department of Higher Education
(Scholarship Division)
PRADHAN MANTRI UCHCHATAR SHIKSHA PROTSAHAN (PM-USP)
CENTRAL SECTOR SCHEME OF SCHOLARSHIP
FOR COLLEGE AND UNIVERSITY STUDENTS (CSSS)
FREQUENTLY ASKED QUESTIONS (FAQs)
2025-26
ABOUT THE SCHEME
The “Pradhan Mantri Uchchatar Shiksha Protsahan (PM-USP) Central Sector Scheme of
Scholarship for College and University Students” is implemented by the Department of
Higher Education since 2008. The objective of the scheme is to provide financial
assistance to the meritorious students, to meet a part of their day-to-day expenses while
pursuing higher studies.
1.
What are the eligibility criteria for applying the “Central Sector Scheme of
Scholarship for College and University Students”?
PM-USP Central Sector Scheme of Scholarship for College and University Students is a
merit-cum-means scholarship scheme.
Eligibility conditions for FRESH application:
 Students who are above 80th percentile of successful candidates in the relevant
stream from a particular Board of Examination in Class XII
 Students pursuing regular course (not correspondence or distance mode)
 Having family income upto Rs. 4.5 lakh per annum
 Not receiving any other scholarship or fee reimbursement of any kind
 Diploma students are not eligible under the scheme.
 Students who had taken a drop after 12th class are not eligible under the scheme.
2.
What is the methodology adopted for generating Merit List for selecting the
beneficiaries under the Scheme?
From the eligible applicants, merit list is drawn based on gender (50 boys: 50 girls),
stream (3-Science: 1-Commerce: 3-Humanities), Category (SC-15 %, ST-7.5 % and
OBC-27 %), and 5 % horizontal reservation is provided for students with Benchmark
Disabilities (Disability of 40% or more) from the allocated slots of respective State
Education Boards. In case of shortfall in the number of applications, the scholarship slots
shall be interoperable among categories (Gen, OBC, SC & ST), gender (Female, Male)
and State Quota to maximize use of slots for fresh scholarships with effect from academic', 2129, 1, 1, now()),
  ('00000000-0000-4000-8000-000000002101', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000000001', 1, 'year 2022-23, subject to the condition that guidelines of Ministry of Finance and NITI
Aayog regarding SC/ST fund allocation of the schemes are adhered to.
3.
What is the rate of scholarship under the Scheme?
The rate of scholarship is Rs. 12,000/- per annum at Graduation level for first three years
of College and University courses and Rs. 20,000/- per annum at Post-Graduation level.
Students pursuing technical courses are paid Rs. 20,000/- per annum in the 4th and 5th year.
Students pursing B.Tech/ BE would get scholarship for 4 years only i.e Rs. 12000 per
annum for first three years and Rs. 20,000 per annum in the 4th year.
4.
How a second/ third/ fourth year student gets scholarships?
All the students finally selected for scholarship in first year are eligible for renewal of
scholarships in 2nd/ 3rd years subject to fulfilment of certain eligibility conditions. The
students have to apply again in the same portal as renewal applicant and provide necessary
marksheets, etc. for this. The applicant should not receive scholarship from any other
department/ ministry.
5.
What is the duration of scholarships and criteria for renewal under the
scheme?
A student will be eligible for the scholarship for a total duration not exceeding 5 years. A
scholarship under the scheme is renewable on year-to-year basis up to Post Graduate level
(except for the students pursuing technical courses leading to degree at graduation level).
Student must secure at least 50% marks and maintain adequate attendance of at least 75%.
6.
What is the methodology for disbursement of scholarship under the Scheme?
Scholarship is disbursed through Direct Benefit Transfer (DBT) mode i.e. directly into the
bank accounts of the beneficiary. The scholarship amount will be disbursed in the Aadhaar
Seeded Bank Account. To have seamless disbursal of scholarships, students are required
to seed the Aadhaar with the bank account as mentioned in the application form. The
student can track his/her payment status from the template “Know Your Payment” in the
Public Financial Management System (PFMS) portal and can also check status on NSP
with their login credentials. If the PFMS status is shown as “Success”, then the student is
required to check the status of the bank account which was seeded with Aadhaar at the
time of transaction.
7.
What is Aadhaar Seeding with Bank Account?
The Aadhaar Seeding means linking Aadhaar holder’s Unique 12-digit AADHAAR
number with their Bank Account number for receiving Direct Benefit Transfers (DBT)
provided under various Government schemes like, Scholarships.
8.
How to seed an Aadhaar number with a Bank Account?
The following is the process flow of Aadhaar seeding
a. The student has to visit the bank branch where she is holding an account and
submit the duly filled consent form
b. The bank officials after verifying the details and documents provided (as may be
required) and authenticity of the customer based on the signature will accept', 2976, 2, 2, now()),
  ('00000000-0000-4000-8000-000000002102', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000000001', 2, 'Aadhaar seeding consent form and provide an acknowledgement.
c. The branch will then link the Aadhaar number to the customer’s account and also
in NPCI mapper.
9.
How to check the Aadhaar Seeding Status?
The Aadhaar Seeding status can be checked on Bharat Aadhaar Seeding Enabler
(BASE) platform on NPCI. To use BASE, a student has to:
a. Go to the BASE URL
b. Click on the Consumer tab
c. Click on Bharat Aadhaar Seeding Enabler (BASE)
d. Select the dropdown to get Aadhaar mapping status or history
10.
Who can apply for scholarship under PM-USP CSSS on National Scholarship
Portal (NSP)?
(a)
FRESH: Students who have completed Class-XII in the last Academic Year and
who are in the Top 20th percentile list of concerned Board (SEB/CBSE/CISCE) and got
admission in 1st year of regular graduation course are eligible to apply for fresh
scholarship. This list is given by the respective state education boards. Those who are not
covered in this list will not be able to avail the benefits of PM-USP CSSS scholarship
scheme.
(b)
RENEWAL: Students who have received fresh scholarship in last four academic
years (e.g for AY 2025-26, beneficiaries of AY 2021-22, 2022-23, 2023-24 and 2024-25),
can apply on the National Scholarship Portal http://scholarships.gov.in/ for renewal before
the cut-off date.
To receive renewal scholarship, it is compulsory for the scheme beneficiaries to
apply on NSP. If missed out in an academic year, he/she can apply for renewal in
subsequent year subject to fulfilling other renewal eligibility criteria (For Example,
Student who missed to apply for the renewal in 2024-25 can apply for the Renewal 2025-
26). Therefore, applicant has to ensure to apply for renewal on portal and to get his/her
application verified by the Institute and State Nodal officer, before closure of the portal.
11.
What is One-Time Registration (OTR)?
One-Time Registration (OTR) is a unique number provided to streamline the scholarship
registration process. Users register with their mobile number and complete e-KYC
(electronic Know Your Customer). The OTR number is generated once and remains valid
throughout the student''s academic career.
12.
How to get the OTR number?
To create OTR, student should first keep the following documents ready: (a) Active
mobile number, (b) Aadhaar number (in absence of Aadhaar Number, Aadhaar Enrollment
ID), (c) Mobile number linked with Aadhaar.', 2395, 3, 3, now()),
  ('00000000-0000-4000-8000-000000002103', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000000001', 3, '13. What should I do if I forget my OTR number?
If you forget your OTR number, you can retrieve it by selecting the "Forgot OTR
Number" option. To recover your OTR number, you will need to provide the Aadhaar
number used during your e-KYC process.
14. How can I apply for scholarship under PM-USP CSSS?
Login with your Aadhaar/ OTR number. The pre-filled personal details will be fetched
automatically from the OTR registration form. Now, to generate your Application ID, the
students are required to select their Domicile State and the “Post-Matric” option from the
drop-down menu.
The generated Application ID will be available under ‘My Application’. The student can
now submit the application by filling the appropriate General information, Category and
Academic details; and select the “PM-USP Central Sector Scheme of Scholarship for
College and University Students”. After this, upload the mandatory documents and submit
the application form.
15. What are the precautions to be kept in mind at the time of online application
registration?
a. While filling the application, student is required to ensure that the name of self,
name of father and Roll No., should exactly match as it has been mentioned in the
Roll Card/Mark sheet, so that the data gets captured and the scheme is visible on
the National Scholarship Portal.
Note:- in case of name mismatch in 12th examination marks sheet and
Aadhaar card, students are advised to get the name in Aadhaar same as in
his/her mark sheet.
(For example:- Father’s Name as per mark sheet- Shri Mahendra Pratap Singh and
father’s name as per AADHAAR is M.P. Singh – Scheme will not be visible)
b. Have a valid personal email ID and mobile no. which should be kept active till
the completion of Scholarship disbursement Process. It is advisable not to
change the mobile number for the duration of the scholarship. NSP may send
necessary intimation and information through the registered Mobile number. In
case a candidate does not have a valid personal e-mail ID, he/she should create
his/her new e-mail ID and mobile no. before applying on-line and must maintain
that email account and mobile number. Future necessary information and relevant
OTP would be provided on mentioned mobile number. The students are advised
to mention their own mobile number. The students must also check the SMS
from NIC-NSP regularly.
c. NIC and MoE do not send any communication other than Email/SMS.
d. No change in E-mail ID and mobile number will be entertained during the entire
process.
e. The demographic details provided in the OTR login, need to be same as that in the
Aadhaar and the 12th examination marks sheet.
f. Any change in the demographic details like Name, Father’s Name, Date of Birth,
Contact Information need to be performed in the OTR login and the same need to
be authenticated through e-KYC and face authentication again.', 2875, 4, 4, now()),
  ('00000000-0000-4000-8000-000000002104', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000000001', 4, '16. When to apply for scholarship on the National Scholarship Portal?
The application process is live on National Scholarship Portal (NSP) from 2 June,
2025 (www.scholarships.gov.in).
17. What precautions are to be exercised while selecting the institution from the
drop-down menu?
While selecting the course, where he/she is studying, if there are similar courses with
difference in course duration, student need to ascertain that they are selecting the right
course from their Institute Nodal Officers. If the duration of course is not selected
appropriately, then the students will face error during Renewal of application.
18. What precautions are to be exercised while selecting the institution from the
drop-down menu?
While selecting the Institute, where he/she is studying, in the circumstances of having
common /matching name of institutions, student need to ascertain the right institute by
AISHE code assigned to all institutions. For example:
State
Nature of Institute
Name of Institute
AISHE Code
Haryana
Technical/Polytechnic GOVERNMENT POLYTECHNIC,
CHIKLA
S-958
Haryana
Technical/Polytechnic GOVERNMENT POLYTECHNIC
FOR
WOMEN SIRSA
S-960
Haryana
Technical/Polytechnic GOVERNMENT POLYTECHNIC,
HISAR
S-961
Haryana
Technical/Polytechnic GOVERNMENT POLYTECHNIC,
MANDKOLA
S-966
Haryana
Technical/Polytechnic GOVERNMENT POLYTECHNIC,
ROHTAK
S-955
Haryana
Technical/Polytechnic GOVERNMENT POLYTECHNIC,
NILOKHERI
S-969
Clicking the FINAL SUBMIT button, after incorrect selection of institution shall lead to
non-verification of applications by the institution, which cannot be corrected thereafter
and such grievance will not be entertained.
Further, the students are requested to check the Status of the institute on the AISHE Portal
(https://dcf.aishe.nic.in/aishenew/#/details/knowAisheCode), since the scholarship payment
won’t be released to the students studying in the institutes whose Status is INACTIVE.', 1917, 5, 5, now()),
  ('00000000-0000-4000-8000-000000002105', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000000001', 5, '19. What are the documents that are required to be uploaded for applying and
verification?
The following documents need to be uploaded on the Portal at the time of application:
a. FRESH: 12th Mark Sheet, Family Income Certificate, Category/ caste Certification
for reserved category students, Disability Certificate (if applicable)
b. RENEWAL: Previous Year Mark Sheet
The copy of above-mentioned documents must be provided to the institutes at the time of
verification, if sought for by the Institute Nodal Officer (INO).
20.
Can I edit the information already saved and upto what time?
You can edit the information till final submission of the online application. After final
submission of application, information can only be edited when your application is marked
as defective by the verification authority.
21.
Which fields I can edit?
You can edit all details except the Personal Details provided during OTR. It may be noted
that once you click on “Confirm and Submit” button your application will be forwarded to
the next level and then you cannot edit further.
22.
Do I have to fill up the online application in one sitting?
No. You can fill the online application in many sittings, until you are satisfied that you
have entered all desirable fields correctly. The software provides facility to save your
application at every stage until you click on ‘Confirm & Submit’ button.
23.
What is UID number/Aadhaar Number?
UID number otherwise known as ‘Aadhaar’ number is Unique Identification Number
given by Unique Identification Authority of India (UIDAI). The Aadhaar Number should
be seeded with the Bank Account in which Scholarship Amount is desired to be
transferred.
24.
How should I check the status of my application online?
You have to login under the option ‘Student Login’ by entering your Aadhaar number/
OTR number. After login, under the option ‘My Application’, you will be able to view the
option ‘Check Your Status’ against your Application ID. Under this option you can check
your online application status.
25.
How do I know the name and address of the Nodal Officers my State Education
Board/CBSE/CISCE?
The name and contact details of the Nodal Officer of the State Education
Boards/CBSE/CISCE are available in the Nodal Officers (Scheme Wise) option available
under the Public Corner on the home page of National Scholarship Portal (NSP).', 2366, 6, 6, now()),
  ('00000000-0000-4000-8000-000000002106', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000000001', 6, '26.
Where to lodge complaints/queries/grievances regarding scholarship application?
The grievances need to be register on the Grievance Registration Tab available in their
Login. All the technical complaints regarding working of the portal/ processing of online
application/ verification status, etc. may be addressed to the National Scholarship Portal.
Grievances regarding “PM-USP Central Sector Scheme of Scholarship for College and
University Students” may be addressed to Department of Higher Education, MoE.
27.
Whether the applicants or the institutes need to send the Physical copy of the online
application form to State Nodal Officer or Ministry?
No, it is not needed
28.
What to know about the withdrawal of the application?
The student can withdraw their scholarship application by selecting the appropriate option
from the Drop-Down menu. If a student wants to avail benefits of any other
scholarship scheme, then they must withdraw from the present scheme. The
scholarship application can be withdrawn by the applicant prior to its final verification by
the State Nodal Agency.
Note: Do not use the option unless you want to surrender the scholarship.
29.
 Can I apply for the scholarship if I’m enrolled in a private college?
Yes, provided the private college is recognized by a regulatory body (like AICTE, UGC,
etc.) and listed on the AISHE portal.
30.
Can I apply using EID (Enrollment ID) instead of Aadhaar?
Yes, if you do not have an Aadhaar number, you may apply using your Aadhaar
Enrollment ID, but update the Aadhaar on receiving the Aadhaar number, as Aadhaar is
mandatory for final scholarship disbursal.
31.
Can I apply using Parent’s Aadhaar?
Yes, minor applicants can apply with their Parent’s Aadhaar but the applicant must submit
their Aadhaar on attaining the age of 18 years.
32.
 What is the difference between ‘Defective’ and ‘Rejected’ applications on NSP?
Defective: There are errors you can correct and resubmit.
Rejected: Your application is permanently disqualified due to non-fulfillment of eligibility
or incorrect data.
33.
 What happens if I miss the renewal deadline?
You can apply for renewal in the following year, subject to eligibility criteria.
34.
 Is there any fee to apply for this scholarship?
No, application on the National Scholarship Portal is completely free of cost.', 2327, 7, 7, now()),
  ('00000000-0000-4000-8000-000000002107', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000000001', 7, '35.
What to do if the course under which the student is enrolled is not available
after selecting the Institute?
This situation arises when the Institute in which the student is studying has not updated
his/her profile. Hence, the student has to ask their Institute Nodal Officer to update their
profile and validate all the courses and their duration. For further guidance, the institute
may check the information under the Institutions option available on the National
Scholarship Portal Homepage.
IMPORTANT Notes for the Applicants:
 After finally submitting the applications on the portal students are advised to
get their online application verified by the respective institutions before the
cut-off date. Application which is not verified either by the institute or by the
concerned State Higher Education Department /State Nodal Agency or by both will
be treated as ‘Invalid’.
 For College and course change after completion of graduation courses
(general degree course), use the option update college/institution and course in
your login. After filling right college/institution and course name then only
click on submit button because once this request is submitted, system disables
the option to update college and course. If the student clicks the submit option
without updating the option or filling wrong information, then student will not get
another chance.
 For change in college during 2nd and 3rd year of the course, kindly contact
your State Nodal Agency at least 2 weeks prior to closing date of NSP along
with following documents: (a) Previous and Present College ID card, (b)
Present and Previous College Name and AISHE Code, (c) Present and
Previous Course. The requests for change in college received in the last 7 days
prior to closing of NSP will not be entertained.
 Jammu and Kashmir Board students who passed 12th examination in
November 20xx (2024) must have to enter 20xx+1 (2025) in the column
“12thpassing year” while filling scholarship application form online on NSP.
Contact us:
Scholarship Division, Department
of Higher Education, Ministry of
Education, West Block 1, 2nd
Floor, Wing 6, Room No. 6, R. K.
Puram, Sector 1, New Delhi
110066.
Telephone: 011-20862360,
Email: ns1-scholarship@gov.in', 2236, 8, 8, now());

-- ------------------------------------------------------------------ requirements
insert into public.requirements (id, session_id, code, description, category, importance, why_it_matters, expected_evidence, order_index, engine, created_at)
values
  ('00000000-0000-4000-8000-010100000001', '00000000-0000-4000-8000-000000000001', 'R01', 'Board percentile eligibility', 'figures', 'high', 'Named by the researcher as a requirement for this objective; the analysis has to establish it from the reviewed documents.', 'A statement in the reviewed documents that settles “Board percentile eligibility” for AY 2026–27.', 0, 'heuristic', now()),
  ('00000000-0000-4000-8000-010100000002', '00000000-0000-4000-8000-000000000001', 'R02', 'Course type', 'eligibility', 'low', 'Named by the researcher as a requirement for this objective; the analysis has to establish it from the reviewed documents.', 'A statement in the reviewed documents that settles “Course type” for AY 2026–27.', 1, 'heuristic', now()),
  ('00000000-0000-4000-8000-010100000003', '00000000-0000-4000-8000-000000000001', 'R03', 'Family income limit', 'figures', 'high', 'Named by the researcher as a requirement for this objective; the analysis has to establish it from the reviewed documents.', 'A statement in the reviewed documents that settles “Family income limit” for AY 2026–27.', 2, 'heuristic', now()),
  ('00000000-0000-4000-8000-010100000004', '00000000-0000-4000-8000-000000000001', 'R04', 'No other scholarship', 'eligibility', 'low', 'Named by the researcher as a requirement for this objective; the analysis has to establish it from the reviewed documents.', 'A statement in the reviewed documents that settles “No other scholarship” for AY 2026–27.', 3, 'heuristic', now()),
  ('00000000-0000-4000-8000-010100000005', '00000000-0000-4000-8000-000000000001', 'R05', 'Scholarship amount', 'figures', 'medium', 'Named by the researcher as a requirement for this objective; the analysis has to establish it from the reviewed documents.', 'A statement in the reviewed documents that settles “Scholarship amount” for AY 2026–27.', 4, 'heuristic', now()),
  ('00000000-0000-4000-8000-010100000006', '00000000-0000-4000-8000-000000000001', 'R06', 'Renewal conditions', 'continuation', 'medium', 'Named by the researcher as a requirement for this objective; the analysis has to establish it from the reviewed documents.', 'A statement in the reviewed documents that settles “Renewal conditions” for AY 2026–27.', 5, 'heuristic', now()),
  ('00000000-0000-4000-8000-010100000007', '00000000-0000-4000-8000-000000000001', 'R07', 'Complete list of required documents', 'documents', 'high', 'Named by the researcher as a requirement for this objective; the analysis has to establish it from the reviewed documents.', 'A statement in the reviewed documents that settles “Complete list of required documents” for AY 2026–27.', 6, 'heuristic', now()),
  ('00000000-0000-4000-8000-010100000008', '00000000-0000-4000-8000-000000000001', 'R08', 'Application procedure', 'process', 'medium', 'Named by the researcher as a requirement for this objective; the analysis has to establish it from the reviewed documents.', 'A statement in the reviewed documents that settles “Application procedure” for AY 2026–27.', 7, 'heuristic', now()),
  ('00000000-0000-4000-8000-010100000009', '00000000-0000-4000-8000-000000000001', 'R09', 'Application deadline for 2026-27', 'timing', 'high', 'Named by the researcher as a requirement for this objective; the analysis has to establish it from the reviewed documents.', 'A statement in the reviewed documents that settles “Application deadline for 2026-27” for AY 2026–27.', 8, 'heuristic', now()),
  ('00000000-0000-4000-8000-010100000010', '00000000-0000-4000-8000-000000000001', 'R10', 'Reservation and seats', 'figures', 'low', 'Named by the researcher as a requirement for this objective; the analysis has to establish it from the reviewed documents.', 'A statement in the reviewed documents that settles “Reservation and seats” for AY 2026–27.', 9, 'heuristic', now()),
  ('00000000-0000-4000-8000-010100000011', '00000000-0000-4000-8000-000000000001', 'R11', 'Change of institution', 'process', 'low', 'Named by the researcher as a requirement for this objective; the analysis has to establish it from the reviewed documents.', 'A statement in the reviewed documents that settles “Change of institution” for AY 2026–27.', 10, 'heuristic', now()),
  ('00000000-0000-4000-8000-010100000012', '00000000-0000-4000-8000-000000000001', 'R12', 'Verification process', 'process', 'medium', 'Named by the researcher as a requirement for this objective; the analysis has to establish it from the reviewed documents.', 'A statement in the reviewed documents that settles “Verification process” for AY 2026–27.', 11, 'heuristic', now()),
  ('00000000-0000-4000-8000-010100000013', '00000000-0000-4000-8000-000000000001', 'R13', 'Scheme valid for 2026-27', 'timing', 'high', 'Named by the researcher as a requirement for this objective; the analysis has to establish it from the reviewed documents.', 'A statement in the reviewed documents that settles “Scheme valid for 2026-27” for AY 2026–27.', 12, 'heuristic', now());

-- ------------------------------------------------------------------ evidence (excerpts from the PDFs)
insert into public.evidence_items (id, session_id, source_id, chunk_id, claim_text, summary, context_note, page_number, quote_verified, locator, engine, created_at)
values
  ('00000000-0000-4000-8000-020100000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-001100000001', '00000000-0000-4000-8000-000000002001', 'ELIGIBILITY Students who are above 80111 percentile of successful candidates in the relevant stream from the respective Board of Examination in Class XII of 10+2 pattern or equivalent and pursuing regular courses (not correspondence or distance mode) in Colleges/Institutions recognized by All India Council of Technical Education, UGC Act, 1956, Medical Council of India, Dental Council of India and respective regulatory authorities and not availing benefit of any other scholarship scheme including State run scholarship schemes/Fee waiver and', null, 'Selected by weighted term matching over this session''s documents, not by semantic understanding. Verify that this passage actually addresses the requirement.', 2, true, 'chunk 1', 'heuristic', now()),
  ('00000000-0000-4000-8000-020100000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000002100', 'Eligibility conditions for FRESH application:  Students who are above 80th percentile of successful candidates in the relevant stream from a particular Board of Examination in Class XII  Students pursuing regular course (not correspondence or distance mode)  Having family income upto Rs.', null, 'Selected by weighted term matching over this session''s documents, not by semantic understanding. Verify that this passage actually addresses the requirement.', 1, true, 'chunk 0', 'heuristic', now()),
  ('00000000-0000-4000-8000-020100000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000002102', '(a) FRESH: Students who have completed Class-XII in the last Academic Year and who are in the Top 20th percentile list of concerned Board (SEB/CBSE/CISCE) and got admission in 1st year of regular graduation course are eligible to apply for fresh scholarship.', null, 'This passage refers to an earlier cycle than the one being researched. Nothing here establishes the position for the target cycle.', 3, true, 'chunk 2', 'heuristic', now()),
  ('00000000-0000-4000-8000-020100000004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-001100000001', '00000000-0000-4000-8000-000000002002', 'ANNOUNCEMENT OF THE SCHEME AND SELECTION PROCEDURE I) National Scholarship Ponal (NSP) www.scholarships.gov.in will be opened for online application in the month ofJune-July every year.', null, 'Selected by weighted term matching over this session''s documents, not by semantic understanding. Verify that this passage actually addresses the requirement.', 3, true, 'chunk 2', 'heuristic', now()),
  ('00000000-0000-4000-8000-020100000005', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-001100000001', '00000000-0000-4000-8000-000000002003', 'A scholar would be allowed to continue/renew his/her scholarship if, he/she changes the course of study to a stream not offered by his school Board in Class XTI (e.g.', null, 'Selected by weighted term matching over this session''s documents, not by semantic understanding. Verify that this passage actually addresses the requirement.', 4, true, 'chunk 3', 'heuristic', now()),
  ('00000000-0000-4000-8000-020100000006', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000002105', 'FRESH: 12th Mark Sheet, Family Income Certificate, Category/ caste Certification for reserved category students, Disability Certificate (if applicable) b.', null, 'Selected by weighted term matching over this session''s documents, not by semantic understanding. Verify that this passage actually addresses the requirement.', 6, true, 'chunk 5', 'heuristic', now()),
  ('00000000-0000-4000-8000-020100000007', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000002101', 'All the students finally selected for scholarship in first year are eligible for renewal of scholarships in 2nd/ 3rd years subject to fulfilment of certain eligibility conditions.', null, 'Selected by weighted term matching over this session''s documents, not by semantic understanding. Verify that this passage actually addresses the requirement.', 2, true, 'chunk 1', 'heuristic', now()),
  ('00000000-0000-4000-8000-020100000008', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000002103', 'Have a valid personal email ID and mobile no. which should be kept active till the completion of Scholarship disbursement Process.', null, 'Selected by weighted term matching over this session''s documents, not by semantic understanding. Verify that this passage actually addresses the requirement.', 4, true, 'chunk 3', 'heuristic', now()),
  ('00000000-0000-4000-8000-020100000009', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000002106', 'No, application on the National Scholarship Portal is completely free of cost.', null, 'Selected by weighted term matching over this session''s documents, not by semantic understanding. Verify that this passage actually addresses the requirement.', 7, true, 'chunk 6', 'heuristic', now()),
  ('00000000-0000-4000-8000-020100000010', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-001100000001', '00000000-0000-4000-8000-000000002004', 'PROCEDURE FOR RENEWAL OF SCHOLARSHIP For students of Academic Year 2008-09 to 2014-15 (up to 3rd renewal) Students who have passed Class XII in the Academic Year 2008-09 to 2014-15 (up to 3n1 renewal) are required to obtain the renewal application blank fonn from the respective State Education Boards and submit the same duly certified from their respective institutions which is required to certify: (a) that the student has secured 60 o/o or more marks in the previous exam, (b) that the student has 75 % attendance and (c) that the student is not involved in any ragging activities.', null, 'Selected by weighted term matching over this session''s documents, not by semantic understanding. Verify that this passage actually addresses the requirement.', 5, true, 'chunk 4', 'heuristic', now()),
  ('00000000-0000-4000-8000-020100000011', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000002107', 'Application which is not verified either by the institute or by the concerned State Higher Education Department /State Nodal Agency or by both will be treated as ‘Invalid’.  For College and course change after completion of graduation courses (general degree course), use the option update college/institution and course in your login.', null, 'Selected by weighted term matching over this session''s documents, not by semantic understanding. Verify that this passage actually addresses the requirement.', 8, true, 'chunk 7', 'heuristic', now()),
  ('00000000-0000-4000-8000-020100000012', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-001100000002', '00000000-0000-4000-8000-000000002104', 'For example: State Nature of Institute Name of Institute AISHE Code Haryana Technical/Polytechnic GOVERNMENT POLYTECHNIC, CHIKLA S-958 Haryana Technical/Polytechnic GOVERNMENT POLYTECHNIC FOR WOMEN SIRSA S-960 Haryana Technical/Polytechnic GOVERNMENT POLYTECHNIC, HISAR S-961 Haryana Technical/Polytechnic GOVERNMENT POLYTECHNIC, MANDKOLA S-966 Haryana Technical/Polytechnic GOVERNMENT POLYTECHNIC, ROHTAK S-955 Haryana Technical/Polytechnic GOVERNMENT POLYTECHNIC, NILOKHERI S-969 Clicking the FINAL SUBMIT button, after incorrect selection of institution shall lead to non-verification of applicati', null, 'Selected by weighted term matching over this session''s documents, not by semantic understanding. Verify that this passage actually addresses the requirement.', 5, true, 'chunk 4', 'heuristic', now());

-- ------------------------------------------------------------------ evidence links
insert into public.evidence_links (session_id, evidence_id, requirement_id, relation, rationale, confidence, engine, created_at)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000001', '00000000-0000-4000-8000-010100000001', 'SUPPORTS', 'Heuristic match: 4.5 weighted term overlap with this requirement.', 0.2617218628552094, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000001', '00000000-0000-4000-8000-010100000011', 'SUPPORTS', 'Heuristic match: 4.4 weighted term overlap with this requirement.', 0.259403093602751, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000001', '00000000-0000-4000-8000-010100000002', 'PARTIAL', 'Heuristic match: 1.6 weighted term overlap with this requirement.', 0.1891960157500339, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000002', '00000000-0000-4000-8000-010100000001', 'PARTIAL', 'This passage refers to 2025–26, not to the target cycle starting 2026. It cannot establish the position for the target cycle on its own.', 0.2617218628552094, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000002', '00000000-0000-4000-8000-010100000003', 'PARTIAL', 'Heuristic match: 3.6 weighted term overlap with this requirement.', 0.23969165959364422, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000002', '00000000-0000-4000-8000-010100000006', 'PARTIAL', 'Heuristic match: 2.4 weighted term overlap with this requirement.', 0.20890744975914066, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000002', '00000000-0000-4000-8000-010100000010', 'PARTIAL', 'Heuristic match: 2.4 weighted term overlap with this requirement.', 0.20890744975914066, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000003', '00000000-0000-4000-8000-010100000007', 'PARTIAL', 'This passage refers to 2021–22, 2022–23, 2023–24, 2024–25, 2025–26, not to the target cycle starting 2026. It cannot establish the position for the target cycle on its own.', 0.3071933978303555, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000003', '00000000-0000-4000-8000-010100000001', 'PARTIAL', 'This passage refers to 2021–22, 2022–23, 2023–24, 2024–25, 2025–26, not to the target cycle starting 2026. It cannot establish the position for the target cycle on its own.', 0.2617218628552094, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000003', '00000000-0000-4000-8000-010100000013', 'OUTDATED', 'This passage refers to 2021–22, 2022–23, 2023–24, 2024–25, 2025–26, not to the target cycle starting 2026. It cannot establish the position for the target cycle on its own.', 0.2275789517074288, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000004', '00000000-0000-4000-8000-010100000008', 'SUPPORTS', 'Heuristic match: 3.3 weighted term overlap with this requirement.', 0.23193778638604823, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000004', '00000000-0000-4000-8000-010100000013', 'PARTIAL', 'Heuristic match: 3.1 weighted term overlap with this requirement.', 0.2275789517074288, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000004', '00000000-0000-4000-8000-010100000010', 'PARTIAL', 'Heuristic match: 2.4 weighted term overlap with this requirement.', 0.20890744975914066, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000004', '00000000-0000-4000-8000-010100000002', 'PARTIAL', 'Heuristic match: 1.6 weighted term overlap with this requirement.', 0.1891960157500339, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000005', '00000000-0000-4000-8000-010100000011', 'PARTIAL', 'This passage refers to 2018–19, not to the target cycle starting 2026. It cannot establish the position for the target cycle on its own.', 0.259403093602751, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000005', '00000000-0000-4000-8000-010100000003', 'PARTIAL', 'Heuristic match: 3.6 weighted term overlap with this requirement.', 0.23969165959364422, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000005', '00000000-0000-4000-8000-010100000002', 'PARTIAL', 'Heuristic match: 1.6 weighted term overlap with this requirement.', 0.1891960157500339, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000006', '00000000-0000-4000-8000-010100000003', 'PARTIAL', 'Heuristic match: 3.6 weighted term overlap with this requirement.', 0.23969165959364422, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000006', '00000000-0000-4000-8000-010100000005', 'PARTIAL', 'Heuristic match: 3.0 weighted term overlap with this requirement.', 0.22386845157947197, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000006', '00000000-0000-4000-8000-010100000012', 'PARTIAL', 'Heuristic match: 2.0 weighted term overlap with this requirement.', 0.20049564384361032, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000007', '00000000-0000-4000-8000-010100000006', 'PARTIAL', 'This passage refers to 2022–23, not to the target cycle starting 2026. It cannot establish the position for the target cycle on its own.', 0.2372205137277284, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000007', '00000000-0000-4000-8000-010100000005', 'PARTIAL', 'Heuristic match: 3.0 weighted term overlap with this requirement.', 0.22386845157947197, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000008', '00000000-0000-4000-8000-010100000007', 'SUPPORTS', 'Heuristic match: 5.7 weighted term overlap with this requirement.', 0.29171741762019987, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000008', '00000000-0000-4000-8000-010100000013', 'PARTIAL', 'Heuristic match: 3.1 weighted term overlap with this requirement.', 0.2275789517074288, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000009', '00000000-0000-4000-8000-010100000007', 'PARTIAL', 'Heuristic match: 4.9 weighted term overlap with this requirement.', 0.2721737341969007, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000009', '00000000-0000-4000-8000-010100000009', 'PARTIAL', 'Heuristic match: 3.8 weighted term overlap with this requirement.', 0.244708426980198, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000009', '00000000-0000-4000-8000-010100000012', 'SUPPORTS', 'Heuristic match: 3.8 weighted term overlap with this requirement.', 0.244708426980198, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000010', '00000000-0000-4000-8000-010100000008', 'PARTIAL', 'This passage refers to 2008–09, 2014–15, not to the target cycle starting 2026. It cannot establish the position for the target cycle on its own.', 0.23193778638604823, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000011', '00000000-0000-4000-8000-010100000011', 'SUPPORTS', 'Heuristic match: 4.4 weighted term overlap with this requirement.', 0.259403093602751, 'heuristic', now()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-020100000012', '00000000-0000-4000-8000-010100000012', 'SUPPORTS', 'Heuristic match: 3.8 weighted term overlap with this requirement.', 0.244708426980198, 'heuristic', now());

-- ------------------------------------------------------------------ findings
insert into public.findings (id, session_id, kind, title, summary, severity, requirement_id, recommended_verification, status, confidence, engine, created_at)
values
  ('00000000-0000-4000-8000-030100000001', '00000000-0000-4000-8000-000000000001', 'gap', 'Not found in reviewed sources: No other scholarship', 'None of the excerpts reviewed addresses this requirement. This does not establish that the information is unavailable elsewhere — only that the sources reviewed here do not settle it.', 'medium', '00000000-0000-4000-8000-010100000004', 'Consult the authoritative publisher directly (the issuing ministry, department or agency) for the current cycle.', 'open', 0.4, 'heuristic', now()),
  ('00000000-0000-4000-8000-030100000002', '00000000-0000-4000-8000-000000000001', 'outdated', 'May describe an earlier period: Scheme valid for 2026-27', 'The reviewed excerpt refers to an earlier cycle or a period that may have lapsed. Its current validity is unknown, so it should not be relied upon for the target cycle without confirmation.', 'high', '00000000-0000-4000-8000-010100000013', 'Confirm the current cycle and validity directly with the issuing authority.', 'open', 0.4, 'heuristic', now());

insert into public.finding_evidence (finding_id, evidence_id, role, note)
values
  ('00000000-0000-4000-8000-030100000002', '00000000-0000-4000-8000-020100000003', 'context', null);

-- ------------------------------------------------------------------ verification checklist
insert into public.checklist_items (session_id, title, why_it_matters, requirement_id, finding_id, recommended_source, priority, completed, order_index, engine)
values
  ('00000000-0000-4000-8000-000000000001', 'Confirm directly: No other scholarship', 'None of the excerpts reviewed addresses this requirement. This does not establish that the information is unavailable elsewhere — only that the sources reviewed here do not settle it.', '00000000-0000-4000-8000-010100000004', '00000000-0000-4000-8000-030100000001', 'Consult the authoritative publisher directly (the issuing ministry, department or agency) for the current cycle.', 'medium', false, 0, 'heuristic'),
  ('00000000-0000-4000-8000-000000000001', 'May describe an earlier period: Scheme valid for 2026-27', 'The reviewed excerpt refers to an earlier cycle or a period that may have lapsed. Its current validity is unknown, so it should not be relied upon for the target cycle without confirmation.', '00000000-0000-4000-8000-010100000013', '00000000-0000-4000-8000-030100000002', 'Confirm the current cycle and validity directly with the issuing authority.', 'high', false, 1, 'heuristic'),
  ('00000000-0000-4000-8000-000000000001', 'Verify with the authority: Course type', 'The reviewed material only partly supports this requirement, so it cannot be relied on without confirmation.', '00000000-0000-4000-8000-010100000002', null, 'The issuing ministry, department or agency for the current cycle.', 'medium', false, 2, 'heuristic'),
  ('00000000-0000-4000-8000-000000000001', 'Verify with the authority: Family income limit', 'The reviewed material only partly supports this requirement, so it cannot be relied on without confirmation.', '00000000-0000-4000-8000-010100000003', null, 'The issuing ministry, department or agency for the current cycle.', 'high', false, 3, 'heuristic'),
  ('00000000-0000-4000-8000-000000000001', 'Verify with the authority: Scholarship amount', 'The reviewed material only partly supports this requirement, so it cannot be relied on without confirmation.', '00000000-0000-4000-8000-010100000005', null, 'The issuing ministry, department or agency for the current cycle.', 'medium', false, 4, 'heuristic'),
  ('00000000-0000-4000-8000-000000000001', 'Verify with the authority: Renewal conditions', 'The reviewed material only partly supports this requirement, so it cannot be relied on without confirmation.', '00000000-0000-4000-8000-010100000006', null, 'The issuing ministry, department or agency for the current cycle.', 'medium', false, 5, 'heuristic'),
  ('00000000-0000-4000-8000-000000000001', 'Verify with the authority: Application deadline for 2026-27', 'The reviewed material only partly supports this requirement, so it cannot be relied on without confirmation.', '00000000-0000-4000-8000-010100000009', null, 'The issuing ministry, department or agency for the current cycle.', 'high', false, 6, 'heuristic'),
  ('00000000-0000-4000-8000-000000000001', 'Verify with the authority: Reservation and seats', 'The reviewed material only partly supports this requirement, so it cannot be relied on without confirmation.', '00000000-0000-4000-8000-010100000010', null, 'The issuing ministry, department or agency for the current cycle.', 'medium', false, 7, 'heuristic');

-- ------------------------------------------------------------------ job history
insert into public.analysis_jobs (session_id, stage, status, progress, message, engine, started_at, finished_at, payload, created_at)
values
  ('00000000-0000-4000-8000-000000000001', 'extraction', 'succeeded', 100, 'Extracted 2 uploaded document(s) with PyMuPDF, 15 page-preserving chunks.', 'heuristic', now(), now(), '{"documents":2,"chunks":15}'::jsonb, now()),
  ('00000000-0000-4000-8000-000000000001', 'requirements', 'succeeded', 100, '13 requirement(s) taken from the researcher''s objective checklist (titles only, no expected answer) — heuristic engine, no model call.', 'heuristic', now(), now(), '{"requirements":13,"source":"inventory"}'::jsonb, now()),
  ('00000000-0000-4000-8000-000000000001', 'evidence', 'succeeded', 100, '12 excerpt(s) mapped to requirements across 2 source(s).', 'heuristic', now(), now(), '{"evidence":12}'::jsonb, now()),
  ('00000000-0000-4000-8000-000000000001', 'findings', 'succeeded', 100, '2 finding(s) derived from requirement status.', 'heuristic', now(), now(), '{"findings":2}'::jsonb, now()),
  ('00000000-0000-4000-8000-000000000001', 'checklist', 'succeeded', 100, '8 verification item(s) created.', 'heuristic', now(), now(), '{"items":8}'::jsonb, now());
