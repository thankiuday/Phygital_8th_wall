import { Link } from 'react-router-dom';

const UserCertificationAgreementPage = () => (
  <div className="min-h-screen bg-[var(--bg-primary)] px-4 py-10">
    <div className="mx-auto max-w-4xl rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-6 sm:p-8">
      <Link to="/register" className="text-sm font-medium text-brand-400 hover:underline">
        Back to Registration
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-[var(--text-primary)]">User Certification &amp; Agreement</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Required to create an account on phygital.zone
      </p>

      <div className="mt-6 space-y-5 text-sm leading-6 text-[var(--text-secondary)]">
        <p className="font-medium text-[var(--text-primary)]">
          I certify and agree to all of the following (required to create an account):
        </p>
        <p>
          By checking this box and using phygital.zone (the &quot;Service&quot;), I represent, warrant, and certify
          under penalty of perjury as follows:
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">1. Legality of All Content</h2>
          <p>
            All content I upload, post, submit, share, or otherwise make available (&quot;User Content&quot;) complies
            with all applicable U.S. federal, state, and local laws, and does not violate any law in any jurisdiction
            where it is uploaded, stored, accessed, or viewed.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">2. Prohibited Illegal or Harmful Content</h2>
          <p>
            My User Content does NOT contain, depict, promote, or facilitate any of the following:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Child sexual abuse material (CSAM) or any sexualized depiction of minors (18 U.S.C. §§ 2251–2260A)</li>
            <li>Obscene material as defined under Miller v. California and 18 U.S.C. § 1461</li>
            <li>Non-consensual intimate images (&quot;revenge porn&quot;) (18 U.S.C. § 2261A and state laws)</li>
            <li>Terrorism, violent extremism, or material supporting or facilitating terrorism (18 U.S.C. §§ 2339A–2339B)</li>
            <li>Credible threats, stalking, harassment, or cyberstalking (18 U.S.C. §§ 875, 2261A)</li>
            <li>Fraud, phishing, scams, impersonation, or identity theft</li>
            <li>Illegal drugs, controlled substances, or unlicensed pharmaceuticals</li>
            <li>Illegal weapons, explosives, or prohibited dangerous items</li>
            <li>Human trafficking, exploitation, or coerced content</li>
            <li>Defamation, libel, or knowingly false statements about any person or entity</li>
            <li>Content violating U.S. export controls (EAR/ITAR) or OFAC sanctions</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">3. Intellectual Property &amp; Third-Party Rights</h2>
          <p>
            I confirm that I own or have all necessary rights, permissions, and licenses to upload my User Content and
            to grant phygital.zone the rights described in the Terms of Service. My content does not infringe any
            copyright, trademark, patent, trade secret, privacy right, publicity right, or other third-party right.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">4. No Deceptive or Misleading Content</h2>
          <p>
            My User Content is not false, deceptive, misleading, or fraudulent. It does not violate the Computer Fraud
            and Abuse Act, the CAN-SPAM Act, the FTC Act, or any state consumer-protection laws.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">5. Age and Legal Capacity</h2>
          <p>
            I am at least 18 years old (or the legal age of majority in my jurisdiction) and have full legal capacity
            to enter into this agreement.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            6. Phygital.zone&apos;s Right to Remove Content &amp; Terminate Accounts
          </h2>
          <p>
            I acknowledge that phygital.zone may, at its sole and absolute discretion and without prior notice or liability:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Remove, delete, block, or disable any User Content</li>
            <li>Suspend or permanently terminate my account</li>
            <li>
              Preserve or disclose my User Content and account information to:
              <ul className="list-disc space-y-1 pl-5">
                <li>law enforcement,</li>
                <li>the National Center for Missing &amp; Exploited Children (NCMEC), or</li>
                <li>other third parties as required or permitted by law</li>
              </ul>
            </li>
          </ul>
          <p>I waive all rights to advance notice, explanation, appeal, or compensation relating to such actions.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">7. Consequences of Violation</h2>
          <p>I understand that uploading illegal or prohibited content may result in:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Immediate account termination</li>
            <li>Permanent banning</li>
            <li>Civil liability</li>
            <li>Criminal prosecution</li>
            <li>Mandatory reporting to law enforcement and NCMEC (18 U.S.C. § 2258A)</li>
          </ul>
        </section>

        <p>
          This certification is made under penalty of perjury under the laws of the United States and the State of
          Delaware (or my state of residence or incorporation). I understand that knowingly false statements may violate
          18 U.S.C. § 1001 and other federal and state laws.
        </p>
        <p>I have read and agree to the phygital.zone Terms of Service and Community Guidelines.</p>
      </div>

      <div className="mt-8 space-y-2">
        <Link to="/register" className="text-sm font-medium text-brand-400 hover:underline">
          Return to Registration
        </Link>
        <p className="text-xs text-[var(--text-muted)]">Last updated: 5/13/2026</p>
      </div>
    </div>
  </div>
);

export default UserCertificationAgreementPage;
