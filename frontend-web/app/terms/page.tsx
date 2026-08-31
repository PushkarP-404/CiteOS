export default function TermsOfService() {
  return (
    <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-4xl font-sans text-[var(--foreground)]">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 font-handwriting">Terms of Service</h1>
      
      <div className="space-y-6 text-sm md:text-base leading-relaxed">
        <p><strong>Last Updated: {new Date().toLocaleDateString()}</strong></p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold mt-8">1. Agreement to Terms</h2>
          <p>
            By viewing or using CiteOS, you agree to be bound by these Terms of Service and all applicable laws and regulations. 
            If you do not agree with any of these terms, you are prohibited from using or accessing this site.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold mt-8">2. Use License</h2>
          <p>
            Permission is granted to temporarily use CiteOS for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-[var(--foreground)] opacity-90">
            <li>Modify or copy the materials;</li>
            <li>Use the materials for any commercial purpose, or for any public display;</li>
            <li>Attempt to decompile or reverse engineer any software contained on CiteOS;</li>
            <li>Remove any copyright or other proprietary notations from the materials; or</li>
            <li>Transfer the materials to another person or "mirror" the materials on any other server.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold mt-8">3. AI Services and Disclaimer</h2>
          <p>
            CiteOS uses artificial intelligence to assist with research and generate citations. The materials on CiteOS are provided on an 'as is' basis. 
            CiteOS makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
          </p>
          <p>
            You are solely responsible for verifying the accuracy of any generated citations, research data, or text before using it in academic or professional work.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold mt-8">4. Limitations</h2>
          <p>
            In no event shall CiteOS or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on CiteOS, even if CiteOS or a CiteOS authorized representative has been notified orally or in writing of the possibility of such damage.
          </p>
        </section>
      </div>
    </main>
  );
}
