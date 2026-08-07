import { BRANDING } from '@ecoswift/config/branding';

export default function TermsOfServicePage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 md:px-6 md:py-28">
      <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Terms of Service</h1>
      <p className="mt-4 text-sm text-muted-foreground">Last updated: July 30, 2026</p>

      <p className="mt-8 rounded-lg border border-border bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
        {BRANDING.brandName} is a demonstration digital banking platform, built to showcase modern banking UX and
        architecture. It is not a bank, is not chartered or licensed as a financial institution, and does not hold,
        transmit, or process real funds. All accounts, balances, deposits, withdrawals, and transfers on this
        platform are simulated for demonstration, evaluation, and development purposes only.
      </p>

      <div className="mt-10 space-y-10 text-base leading-relaxed text-foreground">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">1. Acceptance of terms</h2>
          <p className="mt-3 text-muted-foreground">
            By creating an account or otherwise using {BRANDING.brandName} (the "Service"), you agree to be bound by these Terms of
            Service. If you do not agree to these terms, do not use the Service.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight">2. Description of the service</h2>
          <p className="mt-3 text-muted-foreground">
            The Service is a demonstration environment that simulates the experience of using a digital bank, including account opening,
            balance tracking backed by a double-entry ledger, and simulated deposits, withdrawals, and transfers. The Service is not
            connected to any real banking network, card network, or payment rail. No real money or currency of any kind is created,
            held, transmitted, or exchanged through the Service, and nothing on the Service constitutes a real financial account,
            deposit, or financial product.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight">3. Eligibility & account registration</h2>
          <p className="mt-3 text-muted-foreground">
            You must provide accurate information when creating an account and are responsible for maintaining the
            confidentiality of your login credentials and any multi-factor authentication methods associated with your account. You are
            responsible for all activity that occurs under your account.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight">4. User responsibilities</h2>
          <p className="mt-3 text-muted-foreground">You agree to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Use the Service only for lawful, legitimate demonstration, testing, or evaluation purposes;</li>
            <li>Not attempt to represent simulated balances or transactions as real funds to any third party;</li>
            <li>Not attempt to circumvent, disable, or interfere with security features of the Service;</li>
            <li>Keep your account credentials secure and notify us of any suspected unauthorized access.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight">5. Prohibited uses</h2>
          <p className="mt-3 text-muted-foreground">You may not use the Service to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Claim, imply, or represent that the Service provides real banking, custody, or payment services;</li>
            <li>Attempt to move, launder, or represent simulated balances as legal tender or real assets;</li>
            <li>Probe, scan, or test the security of the Service without authorization, outside of its intended demonstration use;</li>
            <li>Upload malicious code or attempt to disrupt the availability of the Service for other users;</li>
            <li>Violate any applicable law or the rights of any third party while using the Service.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight">6. Termination</h2>
          <p className="mt-3 text-muted-foreground">
            We may suspend or terminate your access to the Service at any time, with or without notice, including for suspected
            violation of these Terms. You may stop using the Service, or request deletion of your account, at any time by
            contacting us.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight">7. No warranty</h2>
          <p className="mt-3 text-muted-foreground">
            The Service is provided "as is" and "as available," without warranties of any kind, whether express or implied, including
            warranties of merchantability, fitness for a particular purpose, or non-infringement. As a demonstration environment, data may be
            reset, modified, or lost at any time without notice.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight">8. Limitation of liability</h2>
          <p className="mt-3 text-muted-foreground">
            To the fullest extent permitted by law, {BRANDING.brandName} and its operators shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages, or any loss of data, arising out of or related to your use of the
            Service. Because the Service does not involve real funds, no claim may be made for loss of real monetary value.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight">9. Governing law</h2>
          <p className="mt-3 text-muted-foreground">
            These Terms are governed by the laws of the jurisdiction in which {BRANDING.brandName} operates, without regard to conflict
            of law principles. This section is illustrative placeholder text for the demonstration environment and does not designate an
            actual governing jurisdiction.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight">10. Changes to these terms</h2>
          <p className="mt-3 text-muted-foreground">
            We may update these Terms from time to time. When we do, we will update the "Last updated" date at the top of this page.
            Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold tracking-tight">11. Contact us</h2>
          <p className="mt-3 text-muted-foreground">
            Questions about these Terms can be sent to{' '}
            <a
              href={`mailto:${BRANDING.emails.support}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {BRANDING.emails.support}
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
