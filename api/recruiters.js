const { randomUUID } = require('crypto');
const { loadData, updateData } = require('../lib/dataStore');
const { readJsonBody } = require('../lib/http');

const DEFAULT_DECISION_TIMES = {
  Reviewed: 24,
  Approved: 36,
  Rejected: 14,
  'Interview Scheduled': 28,
  Hired: 110
};

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'GET') {
    try {
      const data = await loadData();
      return res.status(200).json({ recruiters: data.recruiters, activeRecruiterId: data.activeRecruiterId });
    } catch (error) {
      console.error('Failed to fetch recruiters.', error);
      return res.status(500).json({ error: 'Failed to fetch recruiters.' });
    }
  }

  if (req.method === 'POST') {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }

    const { name, email } = payload || {};
    const weeklyTarget = Number(payload?.weeklyTarget) || 10;
    const specialty = payload?.specialty || 'New Recruiter';

    if (!name || !email) {
      return res.status(400).json({ error: 'Recruiter name and email are required.' });
    }

    try {
      let createdRecruiter;
      await updateData((data) => {
        const id = payload.id || `r-${randomUUID()}`;
        createdRecruiter = {
          id,
          name,
          email,
          specialty,
          weeklyTarget,
          decisionTimes: payload?.decisionTimes || { ...DEFAULT_DECISION_TIMES }
        };
        data.recruiters.push(createdRecruiter);
        data.activeRecruiterId = createdRecruiter.id;
        return data;
      });
      return res.status(201).json({ recruiter: createdRecruiter });
    } catch (error) {
      console.error('Failed to add recruiter.', error);
      return res.status(500).json({ error: 'Failed to add recruiter.' });
    }
  }

  if (req.method === 'DELETE') {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }

    const { id } = payload || {};
    if (!id) {
      return res.status(400).json({ error: 'Recruiter id is required.' });
    }

    try {
      let reassignedCandidates = [];
      let removed = false;
      await updateData((data) => {
        const index = data.recruiters.findIndex((recruiter) => recruiter.id === id);
        if (index === -1) {
          const error = new Error('Recruiter not found');
          error.statusCode = 404;
          throw error;
        }

        data.recruiters.splice(index, 1);
        reassignedCandidates = data.candidates
          .filter((candidate) => candidate.assignedRecruiterId === id)
          .map((candidate) => {
            candidate.assignedRecruiterId = '';
            return { ...candidate };
          });
        if (data.activeRecruiterId === id) {
          data.activeRecruiterId = data.recruiters[0]?.id || null;
        }
        removed = true;
        return data;
      });

      if (!removed) {
        return res.status(404).json({ error: 'Recruiter not found.' });
      }

      return res.status(200).json({ recruiterId: id, candidates: reassignedCandidates });
    } catch (error) {
      if (error.statusCode === 404) {
        return res.status(404).json({ error: 'Recruiter not found.' });
      }
      console.error('Failed to remove recruiter.', error);
      return res.status(500).json({ error: 'Failed to remove recruiter.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).json({ error: 'Method Not Allowed' });
};
