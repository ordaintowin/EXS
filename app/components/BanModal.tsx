'use client';

const WHATSAPP_SUPPORT_URL = 'https://wa.me/233571827900';

export default function BanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
        <span className="text-5xl block mb-3">🚫</span>
        <h2 className="text-lg font-bold text-gray-800 mb-2">Action Not Permitted</h2>
        <p className="text-sm text-gray-600 mb-5">
          Your account has been restricted from performing this action. Please contact support for assistance.
        </p>
        <a
          href={WHATSAPP_SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm mb-3"
        >
          💬 Contact Support on WhatsApp
        </a>
        <button
          onClick={onClose}
          className="block w-full border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium py-2.5 rounded-xl transition-colors text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}
