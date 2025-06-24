 

import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">StoreSignt Privacy Policy</h1>
          <p className="text-lg text-gray-600">Data Protection & Privacy Compliance</p>
          <div className="mt-4 text-sm text-gray-500">
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
              ✅ GDPR & CCPA Compliant
            </span>
          </div>
        </div>

        <div className="prose prose-lg max-w-none">
          {/* Overview Section */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">📋</span> Overview
            </h2>
            <p className="text-gray-700 leading-relaxed">
              StoreSignt is committed to protecting merchant and customer privacy while providing valuable business analytics. 
              This document outlines our data handling practices in compliance with Shopify's Protected Customer Data requirements.
            </p>
          </section>

          {/* Data Collection Section */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">🔒</span> Data Collection & Processing
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                <h3 className="text-lg font-semibold text-green-800 mb-3">✅ What Data We Collect</h3>
                <ul className="space-y-2 text-green-700">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span><strong>Order Information:</strong> Order totals, dates, payment status, fulfillment status</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span><strong>Customer IDs:</strong> Anonymous customer identifiers for analytics (no personal information)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span><strong>Product Data:</strong> Product names, SKUs, inventory levels</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span><strong>Shop Information:</strong> Store name, currency, timezone</span>
                  </li>
                </ul>
              </div>

              <div className="bg-red-50 p-6 rounded-lg border border-red-200">
                <h3 className="text-lg font-semibold text-red-800 mb-3">❌ What Data We DON'T Collect</h3>
                <ul className="space-y-2 text-red-700">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Customer names, emails, or addresses</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Payment card information</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Personal contact details</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Browsing behavior outside of order data</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Purpose Limitation */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">🎯</span> Purpose Limitation
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">✅ Approved Data Uses</h3>
                <ul className="space-y-2 text-blue-700">
                  <li><strong>Revenue Analytics:</strong> Calculate sales trends and performance metrics</li>
                  <li><strong>Business Intelligence:</strong> Generate insights for merchant decision-making</li>
                  <li><strong>Conversion Tracking:</strong> Analyze order patterns and success rates</li>
                  <li><strong>Inventory Management:</strong> Track product performance and stock levels</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">❌ Prohibited Uses</h3>
                <ul className="space-y-2 text-gray-700">
                  <li>Marketing to customers</li>
                  <li>Selling data to third parties</li>
                  <li>Profiling for non-business purposes</li>
                  <li>Any use outside stated analytics purposes</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Data Retention */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">🗓️</span> Data Retention
            </h2>
            
            <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-yellow-300">
                      <th className="text-left py-2 px-4 font-semibold text-yellow-800">Data Type</th>
                      <th className="text-left py-2 px-4 font-semibold text-yellow-800">Retention Period</th>
                      <th className="text-left py-2 px-4 font-semibold text-yellow-800">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="text-yellow-700">
                    <tr className="border-b border-yellow-200">
                      <td className="py-2 px-4">Order Data</td>
                      <td className="py-2 px-4 font-medium">60 days maximum</td>
                      <td className="py-2 px-4">Recent analytics only</td>
                    </tr>
                    <tr className="border-b border-yellow-200">
                      <td className="py-2 px-4">Aggregated Analytics</td>
                      <td className="py-2 px-4 font-medium">90 days</td>
                      <td className="py-2 px-4">Historical trend analysis</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4">Audit Logs</td>
                      <td className="py-2 px-4 font-medium">365 days</td>
                      <td className="py-2 px-4">Compliance monitoring</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm text-yellow-800 font-medium">
                <strong>Automatic Deletion:</strong> All data is automatically purged after retention periods expire.
              </p>
            </div>
          </section>

          {/* Security Measures */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">🔐</span> Security Measures
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                <h3 className="text-lg font-semibold text-purple-800 mb-3">🔒 Encryption</h3>
                <ul className="space-y-2 text-purple-700">
                  <li><strong>In Transit:</strong> TLS 1.3 encryption for all API communications</li>
                  <li><strong>At Rest:</strong> AES-256 encryption for stored data</li>
                  <li><strong>Key Management:</strong> Secure key rotation every 90 days</li>
                </ul>
              </div>

              <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200">
                <h3 className="text-lg font-semibold text-indigo-800 mb-3">🛡️ Access Controls</h3>
                <ul className="space-y-2 text-indigo-700">
                  <li><strong>Least Privilege:</strong> Staff access limited to essential functions only</li>
                  <li><strong>Audit Logging:</strong> All data access logged and monitored</li>
                  <li><strong>Secure Infrastructure:</strong> Data stored in SOC 2 compliant facilities</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Customer Rights */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">👥</span> Customer Rights
            </h2>
            
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h3 className="text-lg font-semibold text-green-800 mb-4">Data Subject Rights (GDPR/CCPA Compliance)</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2">✅</span>
                    <span className="text-green-700"><strong>Right to Access:</strong> View what data we have about you</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2">✅</span>
                    <span className="text-green-700"><strong>Right to Deletion:</strong> Request complete data removal</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2">✅</span>
                    <span className="text-green-700"><strong>Right to Opt-Out:</strong> Decline data processing for analytics</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2">✅</span>
                    <span className="text-green-700"><strong>Right to Portability:</strong> Export your data in standard formats</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-blue-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">How to Exercise Rights</h3>
              <p className="text-blue-700 mb-3">
                Contact the merchant who installed our app, or reach out to us directly:
              </p>
              <div className="space-y-2 text-blue-700">
                <p><strong>Email:</strong> privacy@storesight.com</p>
                <p><strong>Response Time:</strong> Within 48 hours</p>
                <p><strong>Completion Time:</strong> Within 30 days</p>
              </div>
            </div>
          </section>

          {/* Compliance Status */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">✅</span> Shopify Protected Customer Data Compliance
            </h2>
            
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border border-green-200">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center text-green-700">
                    <span className="mr-2">✅</span>
                    <span><strong>Data Minimization:</strong> Only essential fields processed</span>
                  </div>
                  <div className="flex items-center text-green-700">
                    <span className="mr-2">✅</span>
                    <span><strong>Purpose Limitation:</strong> Processing limited to stated analytics purposes</span>
                  </div>
                  <div className="flex items-center text-green-700">
                    <span className="mr-2">✅</span>
                    <span><strong>Merchant Transparency:</strong> Clear privacy policy and data usage disclosure</span>
                  </div>
                  <div className="flex items-center text-green-700">
                    <span className="mr-2">✅</span>
                    <span><strong>Customer Consent:</strong> Respect consent decisions and opt-out requests</span>
                  </div>
                  <div className="flex items-center text-green-700">
                    <span className="mr-2">✅</span>
                    <span><strong>Data Retention:</strong> 60-day maximum retention with automatic deletion</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center text-green-700">
                    <span className="mr-2">✅</span>
                    <span><strong>Encryption:</strong> TLS 1.3 in transit, AES-256 at rest</span>
                  </div>
                  <div className="flex items-center text-green-700">
                    <span className="mr-2">✅</span>
                    <span><strong>Audit Logging:</strong> Complete audit trail with 365-day retention</span>
                  </div>
                  <div className="flex items-center text-green-700">
                    <span className="mr-2">✅</span>
                    <span><strong>Security Controls:</strong> Access controls, monitoring, and incident response</span>
                  </div>
                  <div className="flex items-center text-green-700">
                    <span className="mr-2">✅</span>
                    <span><strong>Customer Rights:</strong> Data access, deletion, and portability mechanisms</span>
                  </div>
                  <div className="flex items-center text-green-700">
                    <span className="mr-2">✅</span>
                    <span><strong>Staff Training:</strong> Privacy awareness and data handling procedures</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <span className="bg-green-100 text-green-800 px-6 py-2 rounded-full font-bold text-lg">
                  ✅ FULLY COMPLIANT with Shopify Protected Customer Data requirements
                </span>
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">📞</span> Contact Information
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 text-center">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Data Protection Officer</h3>
                <div className="space-y-2 text-gray-700">
                  <p><strong>Email:</strong> dpo@storesight.com</p>
                  <p><strong>Phone:</strong> +1-555-PRIVACY</p>
                  <p className="text-sm">123 Analytics Ave<br/>Data City, DC 12345</p>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 text-center">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Privacy Inquiries</h3>
                <div className="space-y-2 text-gray-700">
                  <p><strong>General:</strong> privacy@storesight.com</p>
                  <p><strong>Data Requests:</strong> requests@storesight.com</p>
                  <p><strong>Security Issues:</strong> security@storesight.com</p>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 text-center">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Policy Updates</h3>
                <div className="space-y-2 text-gray-700">
                  <p><strong>Last Updated:</strong> June 23, 2025</p>
                  <p><strong>Version:</strong> 1.0</p>
                  <p><strong>Next Review:</strong> December 23, 2025</p>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-gray-200 text-center">
            <p className="text-gray-600">
              We will notify merchants of any material changes to this policy with 30 days advance notice.
            </p>
            <div className="mt-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 