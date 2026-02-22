/* =========================================================
   Solar Events — AboutPage.jsx
   ========================================================= */

import './AboutPage.css';
import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../utils';

export default function AboutPage() {
  const [sections, setSections] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadAbout() {
      try {
        setLoading(true);
        setError('');
        const [aboutRes, teamRes] = await Promise.all([
          fetch(`${API_BASE}/api/about`),
          fetch(`${API_BASE}/api/team`),
        ]);
        if (!aboutRes.ok || !teamRes.ok) throw new Error('HTTP error when loading about data');
        const aboutData = await aboutRes.json();
        const teamData = await teamRes.json();
        if (cancelled) return;
        setSections(aboutData || []);
        setTeam(teamData || []);
      } catch (err) {
        console.error('Error loading about/team data:', err);
        if (!cancelled) setError('Unable to load About page content right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAbout();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="about-page">
      {/* Page header */}
      <div className="about-page-header">
        <div className="about-page-label">PROJECT OVERVIEW</div>
        <h1 className="about-page-title">About This Project</h1>
        <div className="about-page-rule" />
      </div>

      {loading && !error && (
        <div className="about-loading">
          <span className="tl-status-dot" />
          Loading content…
        </div>
      )}

      {error && <div className="about-error">{error}</div>}

      {!loading && !error && (
        <div className="about-body">
          {/* Dynamic about sections */}
          <div className="about-sections">
            {sections.length === 0 && (
              <p className="about-empty">No About content has been added yet.</p>
            )}
            {sections.map((section, i) => (
              <article key={section.id} className="about-section">
                <div className="about-section-content">
                  {section.title && <h2 className="about-section-title">{section.title}</h2>}
                  {section.text && <p className="about-section-text">{section.text}</p>}
                </div>
              </article>
            ))}
          </div>

          {/* Team section */}
          <div className="about-team">
            <div className="about-team-header">
              <div className="about-page-label">CONTRIBUTORS</div>
              <h2 className="about-team-title">Meet the Team</h2>
            </div>

            {team.length === 0 ? (
              <p className="about-empty">Team members will appear here once they are added.</p>
            ) : (
              <div className="about-team-grid">
                {team.map((member) => (
                  <div key={member.id} className="about-member">
                    <div className="about-member-photo">
                      {member.image_url ? (
                        <img
                          src={member.image_url}
                          alt={member.name}
                          className="about-member-img"
                        />
                      ) : (
                        <div className="about-member-initials">
                          {member.name
                            ?.split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div className="about-member-info">
                      <div className="about-member-name">{member.name}</div>
                      <div className="about-member-role">{member.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
