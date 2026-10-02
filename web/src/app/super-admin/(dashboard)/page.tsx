export default function SuperAdminDashboard() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow border">
          <p className="text-sm text-gray-500 font-medium">Total Schools</p>
          <p className="text-3xl font-bold mt-2">124</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border">
          <p className="text-sm text-gray-500 font-medium">Total Students</p>
          <p className="text-3xl font-bold mt-2">45,210</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border">
          <p className="text-sm text-gray-500 font-medium">MRR</p>
          <p className="text-3xl font-bold mt-2">$24,500</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border">
          <p className="text-sm text-gray-500 font-medium">ARR</p>
          <p className="text-3xl font-bold mt-2">$294,000</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow border h-96 flex flex-col justify-center items-center">
          <h2 className="text-xl font-bold mb-4 self-start">Revenue Trend</h2>
          <p className="text-gray-400">[Recharts LineChart: Monthly MRR]</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border h-96 flex flex-col justify-center items-center">
          <h2 className="text-xl font-bold mb-4 self-start">Plan Distribution</h2>
          <p className="text-gray-400">[Recharts PieChart: Basic vs Pro vs Enterprise]</p>
        </div>
      </div>
    </div>
  );
}
