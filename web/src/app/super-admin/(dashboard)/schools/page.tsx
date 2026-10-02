export default function SchoolsList() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Schools</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">
          + Provision New School
        </button>
      </div>

      <div className="bg-white rounded-xl shadow border p-6">
        <p className="text-gray-400 text-center py-20">[TanStack Table: List of all provisioned schools]</p>
      </div>
    </div>
  );
}
