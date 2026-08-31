export default function PrivacyPolicy() {
  return (
    <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-4xl font-sans text-[var(--foreground)]">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 font-handwriting">Privacy Policy</h1>
      
      <div className="space-y-6 text-sm md:text-base leading-relaxed">
        <p><strong>Last Updated: {new Date().toLocaleDateString()}</strong></p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold mt-8">1. Introduction</h2>
          <p>
            Welcome to CiteOS ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. 
            This Privacy Policy explains how we collect, use, and safeguard your information when you use our application.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold mt-8">2. Information We Collect</h2>
          <p>
            We collect personal information that you voluntarily provide to us when you register on the application, 
            express an interest in obtaining information about us or our products and services, or otherwise when you contact us.
          </p>
          <ul className="list-disc pl-6 space-y-1 text-[var(--foreground)] opacity-90">
            <li><strong>Personal Information:</strong> We may collect names, email addresses, and passwords.</li>
            <li><strong>Usage Data:</strong> We may collect data regarding your interaction with our AI services to improve the product.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold mt-8">3. How We Use Your Information</h2>
          <p>We use the information we collect or receive:</p>
          <ul className="list-disc pl-6 space-y-1 text-[var(--foreground)] opacity-90">
            <li>To facilitate account creation and logon process.</li>
            <li>To provide and maintain our Service.</li>
            <li>To respond to user inquiries and offer support to users.</li>
            <li>To enforce our terms, conditions, and policies.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold mt-8">4. Cookies and Tracking</h2>
          <p>
            We use essential cookies to maintain your session and save preferences (e.g., citation styles). 
            Currently, we do not use any third-party tracking or analytics scripts.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold mt-8">5. Contact Us</h2>
          <p>
            If you have questions or comments about this policy, you may email us at support@citeos.example.com.
          </p>
        </section>
      </div>
    </main>
  );
}
