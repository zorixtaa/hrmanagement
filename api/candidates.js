const { loadData, updateData } = require('../lib/dataStore');
const { readJsonBody } = require('../lib/http');

const VALID_STAGES = [
  'Applied',
  'Reviewed',
  'Approved',
  'Interview Scheduled',
  'Hired',
  'Rejected'
];

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'GET') {
    try {
      const data = await loadData();
      return res.status(200).json({ candidates: data.candidates });
    } catch (error) {
      console.error('Failed to fetch candidates.', error);
      return res.status(500).json({ error: 'Failed to fetch candidates.' });
    }
  }

  if (req.method === 'PATCH') {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }

    const { id, stage, assignedRecruiterId, notes, cvFile } = payload || {};
    if (!id) {
      return res.status(400).json({ error: 'Candidate id is required.' });
    }

    if (stage && !VALID_STAGES.includes(stage)) {
      return res.status(400).json({ error: 'Invalid candidate stage.' });
    }

    try {
      let updatedCandidate;
      await updateData((data) => {
        const candidate = data.candidates.find((item) => item.id === id);
        if (!candidate) {
          const error = new Error('Candidate not found');
          error.statusCode = 404;
          throw error;
        }
        if (stage && candidate.stage !== stage) {
          candidate.stage = stage;
          candidate.stageStarted = new Date().toISOString().split('T')[0];
          if (stage === 'Hired') {
            candidate.stageCompleted = new Date().toISOString().split('T')[0];
          } else {
            delete candidate.stageCompleted;
          }
        }
        if (assignedRecruiterId !== undefined) {
          candidate.assignedRecruiterId = assignedRecruiterId;
        }
        if (typeof notes === 'string') {
          candidate.notes = notes;
        }
        if (cvFile !== undefined) {
          candidate.cvFile = cvFile || null;
        }
        updatedCandidate = { ...candidate };
        return data;
      });

      return res.status(200).json({ candidate: updatedCandidate });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status === 404) {
        return res.status(404).json({ error: 'Candidate not found.' });
      }
      console.error('Failed to update candidate.', error);
      return res.status(status).json({ error: error.message || 'Failed to update candidate.' });
    }
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ error: 'Method Not Allowed' });
};
