import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "./CompanyHistory.css";

const CompanyHistory = () => {
  const { companyId } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState("history"); // 'history' or 'deals'

  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/companies/${companyId}`);
        setCompany(response.data.data);
        setLoading(false);
      } catch (err) {
        setError("Failed to load company data");
        setLoading(false);
        console.error("Error fetching company data:", err);
      }
    };

    fetchCompanyData();
  }, [companyId]);

  if (loading) return <div className="loading">Loading company history...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!company) return <div className="error">Company not found</div>;

  // Parse and sort history entries by timestamp
  const historyEntries = company.company.change_history || [];

  // Get deals with signing dates
  const dealsWithDates =
    company.deals?.filter(
      (deal) => deal.deal_expected_signing_date || deal.deal_signing_date
    ) || [];

  // Group entries by day
  const groupedByDay = historyEntries.reduce((groups, entry) => {
    const date = new Date(entry.timestamp).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(entry);
    return groups;
  }, {});

  // Render signing dates section
  const renderDealDates = () => {
    if (dealsWithDates.length === 0) {
      return (
        <div className="no-history">No deals with signing dates found</div>
      );
    }

    return (
      <div className="deals-timeline">
        {dealsWithDates.map((deal, index) => (
          <div key={index} className="deal-card">
            <h3 className="deal-title">
              {deal.deal_id || `Deal #${index + 1}`}
              <span
                className={`deal-stage ${deal.stage
                  ?.toLowerCase()
                  .replace(/\s+/g, "-")}`}
              >
                {deal.stage || deal.deal_state}
              </span>
            </h3>
            <div className="deal-amount">
              {deal.deal_amount
                ? `${deal.deal_amount_currency || "USD"} ${Number(
                    deal.deal_amount
                  ).toLocaleString()}`
                : "No amount specified"}
            </div>

            <div className="deal-dates">
              {deal.deal_expected_signing_date && (
                <div className="date-row expected">
                  <div className="date-label">Expected Signing:</div>
                  <div className="date-value">
                    {new Date(
                      deal.deal_expected_signing_date
                    ).toLocaleDateString()}
                  </div>
                </div>
              )}

              {deal.deal_signing_date && (
                <div className="date-row actual">
                  <div className="date-label">Signed On:</div>
                  <div className="date-value">
                    {new Date(deal.deal_signing_date).toLocaleDateString()}
                  </div>
                  <div className="signed-badge">✓ Signed</div>
                </div>
              )}
            </div>

            {/* Timeline visualizer */}
            {deal.deal_expected_signing_date && (
              <div className="signing-timeline">
                <div className="timeline-track">
                  <div
                    className={`timeline-marker ${
                      deal.deal_signing_date ? "completed" : "pending"
                    }`}
                    style={{
                      left: deal.deal_signing_date
                        ? "100%"
                        : getTimelinePosition(deal.deal_expected_signing_date) +
                          "%"
                    }}
                  ></div>
                  {deal.deal_signing_date && (
                    <div
                      className="timeline-progress"
                      style={{ width: "100%" }}
                    ></div>
                  )}
                </div>
                <div className="timeline-labels">
                  <span>Created</span>
                  <span>Expected</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Calculate position for timeline marker (0-100%)
  const getTimelinePosition = (expectedDate) => {
    const now = new Date();
    const expected = new Date(expectedDate);
    const created = new Date(company.company.created_at);

    // If expected date is in the past, show at 100%
    if (expected < now) return 100;

    // Calculate position between created and expected
    const totalDuration = expected - created;
    const elapsed = now - created;
    const position = Math.min(
      100,
      Math.max(0, (elapsed / totalDuration) * 100)
    );

    return position;
  };

  return (
    <div className="company-history">
      <h1>{company.company.name} - History</h1>

      <div className="history-summary">
        <div className="summary-card">
          <h3>Company Details</h3>
          <div className="detail-row">
            <span className="label">Industry:</span>
            <span className="value">
              {company.company.industry_vertical || "Not specified"}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">Size:</span>
            <span className="value">
              {company.company.size || "Not specified"}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">Revenue:</span>
            <span className="value">
              {company.company.revenue
                ? `$${company.company.revenue.toLocaleString()}`
                : "Not specified"}
            </span>
          </div>
        </div>

        <div className="summary-card">
          <h3>History Overview</h3>
          <div className="detail-row">
            <span className="label">Total Changes:</span>
            <span className="value">{historyEntries.length}</span>
          </div>
          <div className="detail-row">
            <span className="label">First Record:</span>
            <span className="value">
              {company.company.created_at
                ? new Date(company.company.created_at).toLocaleDateString()
                : "Unknown"}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">Last Updated:</span>
            <span className="value">
              {company.company.updated_at
                ? new Date(company.company.updated_at).toLocaleDateString()
                : "Unknown"}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">Active Deals:</span>
            <span className="value">{company.deals?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${selectedTab === "history" ? "active" : ""}`}
          onClick={() => setSelectedTab("history")}
        >
          Change History
        </button>
        <button
          className={`tab-button ${selectedTab === "deals" ? "active" : ""}`}
          onClick={() => setSelectedTab("deals")}
        >
          Deal Timeline
        </button>
      </div>

      {selectedTab === "history" ? (
        <div className="timeline">
          {Object.keys(groupedByDay).length > 0 ? (
            Object.keys(groupedByDay)
              .sort((a, b) => new Date(b) - new Date(a)) // Sort dates in descending order
              .map((date) => (
                <div key={date} className="timeline-day">
                  <div className="timeline-date">{date}</div>

                  <div className="timeline-entries">
                    {groupedByDay[date]
                      .sort(
                        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
                      )
                      .map((entry, index) => (
                        <div
                          key={index}
                          className={`timeline-entry ${
                            entry.change_type === "MAJOR" ? "major-change" : ""
                          }`}
                        >
                          <div className="entry-time">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </div>

                          <div className="entry-badge">
                            <span
                              className={`badge ${entry.change_category.toLowerCase()}`}
                            >
                              {entry.change_category.replace(/_/g, " ")}
                            </span>
                            {entry.change_type === "MAJOR" && (
                              <span className="badge major">Major</span>
                            )}
                          </div>

                          <div className="entry-summary">{entry.summary}</div>

                          <div className="entry-details">
                            <h4>Changed Values</h4>
                            <div className="changes-table">
                              {Object.entries(entry.previous_values).map(
                                ([field, value]) => (
                                  <div key={field} className="change-row">
                                    <div className="field-name">{field}</div>
                                    <div className="previous-value">
                                      {value?.toString() || "empty"}
                                    </div>
                                    <div className="arrow">→</div>
                                    <div className="current-value">
                                      {company.company[field]?.toString() ||
                                        "empty"}
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))
          ) : (
            <div className="no-history">
              No history records available for this company
            </div>
          )}
        </div>
      ) : (
        renderDealDates()
      )}
    </div>
  );
};

export default CompanyHistory;
