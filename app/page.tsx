import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-md mx-auto text-center">
          <h1 className="text-2xl font-semibold mb-4 text-gray-800">Tezign AI Backend Service</h1>
          <p className="mb-6 text-gray-600">
            This is the API and Admin host.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/admin" className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition">
              Go to Admin
            </Link>
            <Link href="/api/resources" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
              Test API
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}