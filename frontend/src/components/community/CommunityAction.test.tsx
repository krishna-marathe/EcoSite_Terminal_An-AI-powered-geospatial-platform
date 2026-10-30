import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommunityComplaintForm } from './CommunityComplaintForm';
import { CommunityPetitionsPanel } from './CommunityPetitionsPanel';

describe('CommunityComplaintForm', () => {
  it('renders complaint form with target facilities and grievance categories', () => {
    render(<CommunityComplaintForm />);
    expect(screen.getByText(/File a Community Environmental Grievance/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/1. Select Target Data Centre Facility/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/2. Nature of Environmental Grievance/i)).toBeInTheDocument();
    expect(screen.getByText(/Generate Statutory Representation/i)).toBeInTheDocument();
  });

  it('generates a formal statutory letter when button is clicked', () => {
    render(<CommunityComplaintForm />);
    const generateBtn = screen.getByText(/Generate Statutory Representation/i);
    fireEvent.click(generateBtn);

    expect(screen.getByText(/FORMAL ENVIRONMENTAL GRIEVANCE & CITIZEN COMPLAINT/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Noise Pollution \(Regulation and Control\) Rules 2000/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Copy Letter/i)).toBeInTheDocument();
    expect(screen.getByText(/Download \.txt/i)).toBeInTheDocument();
  });

  it('allows logging grievance to local ledger', () => {
    render(<CommunityComplaintForm />);
    const logBtn = screen.getByText(/Log Grievance Locally/i);
    fireEvent.click(logBtn);

    expect(screen.getByText(/Grievance logged with reference #/i)).toBeInTheDocument();
  });
});

describe('CommunityPetitionsPanel', () => {
  it('renders active citizen petitions with goal counters and statutory demands', () => {
    render(<CommunityPetitionsPanel />);
    expect(screen.getByText(/Citizen Petitions & Civic Legislative Action/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. 1km Acoustic Buffer Mandate/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Zero Potable Water in Cooling/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign This Petition/i)).toBeInTheDocument();
  });

  it('allows signing a petition and displays verification badge', () => {
    render(<CommunityPetitionsPanel />);
    const nameInput = screen.getByLabelText(/Full Name \*/i);
    const cityInput = screen.getByLabelText(/City & Ward \/ Locality \*/i);

    fireEvent.change(nameInput, { target: { value: 'Rajesh Sharma' } });
    fireEvent.change(cityInput, { target: { value: 'Navi Mumbai' } });

    const signBtn = screen.getByRole('button', { name: /Sign This Petition/i });
    fireEvent.click(signBtn);

    expect(screen.getByText(/You Have Signed This Civic Petition/i)).toBeInTheDocument();
    expect(screen.getByText(/Verified Signatory/i)).toBeInTheDocument();
  });
});
