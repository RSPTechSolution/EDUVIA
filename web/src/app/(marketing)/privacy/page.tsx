import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Vidyanexa collects, uses and protects personal data, including children's data, under India's DPDP Act 2023.",
};

const contact = <Link href="/contact" className="font-medium text-primary hover:underline">contact page</Link>;

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="3 October 2026"
      intro={
        <p>
          This policy explains how Vidyanexa handles personal data when schools use our platform and when you visit our
          website. It is written to meet India&apos;s Digital Personal Data Protection Act, 2023 (the &ldquo;DPDP Act&rdquo;).
        </p>
      }
      sections={[
        {
          id: "roles",
          title: "Who is responsible for your data",
          body: (
            <>
              <p>
                <strong>Data a school puts into Vidyanexa</strong> (about its students, parents and staff) belongs to that
                school. The school is the <em>Data Fiduciary</em> and decides why and how the data is used. Vidyanexa acts as
                the school&apos;s <em>Data Processor</em> and handles the data only on the school&apos;s instructions.
              </p>
              <p>
                <strong>Data you give us directly</strong> &mdash; for example when you sign up for a trial, fill in our contact
                form or create an admin account &mdash; is handled by Vidyanexa as Data Fiduciary.
              </p>
            </>
          ),
        },
        {
          id: "collect",
          title: "What we collect",
          body: (
            <ul>
              <li><strong>Account details:</strong> name, email, phone number, role and school.</li>
              <li><strong>School records</strong> entered by a school: student, parent and staff information, attendance, fees, exams and similar records, depending on the modules the school uses.</li>
              <li><strong>Enquiries:</strong> what you send us through the contact or quote forms.</li>
              <li><strong>Security logs:</strong> sign-in times, IP addresses and an audit trail of changes, used to keep accounts safe.</li>
            </ul>
          ),
        },
        {
          id: "children",
          title: "Children's data",
          body: (
            <>
              <p>
                Schools use Vidyanexa to manage records about students, many of whom are under 18. Under the DPDP Act, the
                school is responsible for obtaining verifiable consent from a parent or guardian before processing a
                child&apos;s data. Vidyanexa processes children&apos;s data only to provide the school&apos;s services.
              </p>
              <p>
                We do not use children&apos;s data for advertising, do not track children&apos;s behaviour for profiling, and
                do not sell personal data to anyone.
              </p>
            </>
          ),
        },
        {
          id: "use",
          title: "How we use data",
          body: (
            <ul>
              <li>To run the platform and the parent, staff and driver apps for your school.</li>
              <li>To keep accounts secure, detect misuse and investigate problems.</li>
              <li>To respond to enquiries and provide support.</li>
              <li>To send service messages such as password resets and trial reminders.</li>
            </ul>
          ),
        },
        {
          id: "security",
          title: "How we protect data",
          body: (
            <ul>
              <li>Each school&apos;s records are isolated inside the database, so one school cannot access another&apos;s data.</li>
              <li>Access is limited by role; every sign-in and change is recorded in an audit log the school can review.</li>
              <li>Passwords are stored only as secure hashes. Sign-in sessions can be ended from the account at any time.</li>
              <li>Data is sent over encrypted connections and backed up daily.</li>
            </ul>
          ),
        },
        {
          id: "sharing",
          title: "Who we share data with",
          body: (
            <>
              <p>We share personal data only with service providers that help us run Vidyanexa, under contracts that require them to protect it:</p>
              <ul>
                <li>Cloud hosting and backup providers.</li>
                <li>SMS, email, WhatsApp and payment providers, only when a school switches those features on.</li>
              </ul>
              <p>We may also disclose data when Indian law requires it.</p>
            </>
          ),
        },
        {
          id: "cookies",
          title: "Cookies",
          body: (
            <p>
              We use only essential cookies: secure sign-in cookies that keep you logged in, and a setting that remembers
              your preferred theme. We do not use advertising or tracking cookies.
            </p>
          ),
        },
        {
          id: "retention",
          title: "How long we keep data",
          body: (
            <p>
              School records are kept for as long as the school uses Vidyanexa. When a school leaves, we provide an export on
              request and then delete its data within 90 days, except where the law requires us to keep it longer.
              Enquiries are kept for up to two years.
            </p>
          ),
        },
        {
          id: "rights",
          title: "Your rights",
          body: (
            <>
              <p>Under the DPDP Act you can ask to access, correct or erase your personal data, withdraw consent and nominate someone to act for you.</p>
              <p>
                If your data was entered by your school, please contact the school first; we will help them respond. For
                data you gave us directly, write to us through our {contact}.
              </p>
            </>
          ),
        },
        {
          id: "grievances",
          title: "Grievances and contact",
          body: (
            <p>
              Questions or complaints about this policy can be sent to our Grievance Officer through the {contact}. We will
              respond within 30 days. If you are not satisfied, you may approach the Data Protection Board of India.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes to this policy",
          body: <p>If we make significant changes, we will tell school admins by email and in the app before they take effect.</p>,
        },
      ]}
    />
  );
}
