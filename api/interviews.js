const { updateData, loadData } = require('../lib/dataStore');
const { readJsonBody } = require('../lib/http');
const { randomUUID } = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'GET') {
    try {
      const data = await loadData();
      return res.status(200).json({ interviews: data.interviews });
    } catch (error) {
      console.error('Failed to fetch interviews.', error);
      return res.status(500).json({ error: 'Failed to fetch interviews.' });
    }
  }

  if (req.method === 'POST') {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }

    const { candidateId, recruiterId, date, time, mode, location } = payload || {};
    if (!candidateId || !date || !time) {
      return res.status(400).json({ error: 'Candidate, date and time are required.' });
    }

    try {
      let interviewRecord;
      let updatedCandidate;
      await updateData((data) => {
        const candidate = data.candidates.find((item) => item.id === candidateId);
        if (!candidate) {
          const error = new Error('Candidate not found');
          error.statusCode = 404;
          throw error;
        }
        const recruiter = recruiterId || candidate.assignedRecruiterId;
        if (!recruiter) {
          const error = new Error('A recruiter is required for interviews');
          error.statusCode = 400;
          throw error;
        }

        const id = payload.id || `i-${randomUUID()}`;
        interviewRecord = {
          id,
          candidateId,
          recruiterId: recruiter,
          date,
          time,
          mode: mode || 'Virtual',
          location: location || (mode === 'Virtual' ? 'Virtual' : 'Headquarters')
        };

        const existingIndex = data.interviews.findIndex((item) => item.id === id);
        if (existingIndex >= 0) {
          data.interviews[existingIndex] = interviewRecord;
        } else {
          data.interviews.push(interviewRecord);
        }

        candidate.stage = 'Interview Scheduled';
        candidate.stageStarted = date;
        updatedCandidate = { ...candidate };
        return data;
      });

      return res.status(201).json({ interview: interviewRecord, candidate: updatedCandidate });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status === 404) {
        return res.status(404).json({ error: 'Candidate not found.' });
      }
      if (status === 400) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Failed to schedule interview.', error);
      return res.status(500).json({ error: 'Failed to schedule interview.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method Not Allowed' });
};
