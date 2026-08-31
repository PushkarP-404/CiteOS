import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full border-t border-[var(--margin-line)] bg-[var(--background)] py-4 text-xs md:text-sm text-gray-500 font-sans text-center mt-auto">
      <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-2">
        <p>&copy; {new Date().getFullYear()} CiteOS. All rights reserved.</p>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-blue-500 dark:hover:text-blue-400 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-blue-500 dark:hover:text-blue-400 transition-colors">Terms of Service</Link>
          <Link href="/accessibility" className="hover:text-blue-500 dark:hover:text-blue-400 transition-colors">Accessibility</Link>
        </div>
      </div>
    </footer>
  );
}
