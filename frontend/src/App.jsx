import { useState, useEffect } from "react";
import "./App.css";
import Login from "./Login";
import Signup from "./Signup";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const API_URL = `${API_BASE_URL}/employees`;
const ATTENDANCE_API_URL = `${API_BASE_URL}/attendance`;
const LEAVES_API_URL = `${API_BASE_URL}/leaves`;
const DASHBOARD_API_URL = `${API_BASE_URL}/dashboard/stats`;
const ANNOUNCEMENTS_API_URL = `${API_BASE_URL}/announcements`;
const TRAINING_API_URL = `${API_BASE_URL}/trainings`;

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "Date not specified";

  const dateString = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? new Date(`${dateString}T00:00:00`)
    : new Date(dateString);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function App() {
  const [authPage, setAuthPage] = useState(() =>
    localStorage.getItem("staffsync_token") &&
    localStorage.getItem("staffsync_user")
      ? "app"
      : "login"
  );

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("staffsync_user") || "null");
    } catch {
      return null;
    }
  });
  const [profileName, setProfileName] = useState(() => currentUser?.name || "");
  const [profilePhone, setProfilePhone] = useState(() => currentUser?.phone || "");
  const [profileSaving, setProfileSaving] = useState(false);

  // Role comes from the logged-in user, not a selectable dropdown.
  const role = currentUser?.role || "Employee";

  const [activePage, setActivePage] = useState("Dashboard");

  function handleLogin(result) {
    if (!result?.token || !result?.user) {
      showMessage("Login response is incomplete. Please try again.");
      return;
    }

    localStorage.setItem("staffsync_token", result.token);
    localStorage.setItem("staffsync_user", JSON.stringify(result.user));

    setCurrentUser(result.user);
    setProfileName(result.user.name || "");
    setProfilePhone(result.user.phone || "");
    setActivePage("Dashboard");
    setAuthPage("app");
  }

  function handleLogout() {
    localStorage.removeItem("staffsync_token");
    localStorage.removeItem("staffsync_user");
    setCurrentUser(null);
    setActivePage("Dashboard");
    setAuthPage("login");
  }

  function handleSignupSuccess() {
    setAuthPage("login");
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    try {
      setProfileSaving(true);
      const result = await apiRequest(`${API_BASE_URL}/profile`, {
        method: "PUT",
        body: JSON.stringify({ name: profileName.trim(), phone: profilePhone.trim() }),
      });
      setCurrentUser(result.data);
      localStorage.setItem("staffsync_user", JSON.stringify(result.data));
      showMessage("Profile updated successfully.");
      await fetchEmployees();
    } catch (err) {
      showMessage(err.message);
    } finally {
      setProfileSaving(false);
    }
  }

  // DATA
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [trainings, setTrainings] = useState([]);

  const [dashboardStats, setDashboardStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    onLeaveToday: 0,
    pendingLeaves: 0,
    totalAnnouncements: 0,
    totalTrainings: 0,
  });

  // ATTENDANCE STATES
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate());
  const [attendanceDrafts, setAttendanceDrafts] = useState({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSavingId, setAttendanceSavingId] = useState(null);

  // EMPLOYEE STATES
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [department, setDepartment] = useState("Engineering");
  const [position, setPosition] = useState("");

  // LEAVE STATES
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveEmployeeId, setLeaveEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState("Casual Leave");
  const [leaveStartDate, setLeaveStartDate] = useState(getTodayDate());
  const [leaveEndDate, setLeaveEndDate] = useState(getTodayDate());
  const [leaveReason, setLeaveReason] = useState("");

  // ANNOUNCEMENT STATES
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [announcementSaving, setAnnouncementSaving] = useState(false);

  // TRAINING STATES
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [trainingTitle, setTrainingTitle] = useState("");
  const [trainingDescription, setTrainingDescription] = useState("");
  const [trainingTrainer, setTrainingTrainer] = useState("");
  const [trainingDate, setTrainingDate] = useState(getTodayDate());
  const [trainingTime, setTrainingTime] = useState("");
  const [trainingDuration, setTrainingDuration] = useState("");
  const [trainingMode, setTrainingMode] = useState("Online");
  const [editingTrainingId, setEditingTrainingId] = useState(null);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingSaving, setTrainingSaving] = useState(false);

  // GENERAL STATES
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [error, setError] = useState("");

  const navigation = {
    HR: [
      { name: "Dashboard", icon: "▦" },
      { name: "Employees", icon: "♙" },
      { name: "Attendance", icon: "◷" },
      { name: "Leave Requests", icon: "▤" },
      { name: "Announcements", icon: "◉" },
      { name: "Training", icon: "▣" },
    ],
    Employee: [
      { name: "Dashboard", icon: "▦" },
      { name: "My Profile", icon: "♙" },
      { name: "My Attendance", icon: "◷" },
      { name: "My Leaves", icon: "▤" },
      { name: "Announcements", icon: "◉" },
      { name: "Training", icon: "▣" },
    ],
    Manager: [
      { name: "Dashboard", icon: "▦" },
      { name: "Team Members", icon: "♙" },
      { name: "Attendance", icon: "◷" },
      { name: "Leave Requests", icon: "▤" },
      { name: "Announcements", icon: "◉" },
      { name: "Training", icon: "▣" },
    ],
  };

  function showMessage(message) {
    setNotice(message);
    setTimeout(() => setNotice(""), 3500);
  }

  // ALL PROTECTED API REQUESTS SEND THE LOGIN TOKEN
  async function apiRequest(url, options = {}) {
    const token = localStorage.getItem("staffsync_token");

    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error("The server returned an invalid response.");
    }

    if (response.status === 401) {
      handleLogout();
      throw new Error("Your session expired. Please log in again.");
    }

    if (!response.ok || result.success === false) {
      throw new Error(result.message || "Request failed.");
    }

    return result;
  }

  // EMPLOYEES
  async function fetchEmployees() {
    try {
      setError("");

      const result = await apiRequest(API_URL);

      setEmployees(
        (result.data || []).map((employee) => ({
          id: String(employee._id || employee.id),
          name: employee.name,
          department: employee.department,
          email: employee.email || "",
          position: employee.role || employee.position || "Employee",
        }))
      );
    } catch (err) {
      setError(err.message);
      console.error("Fetch employees error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddEmployee(event) {
    event.preventDefault();

    if (!employeeName.trim() || !position.trim()) {
      showMessage("Please enter the employee name and position.");
      return;
    }

    try {
      setSaving(true);

      await apiRequest(editingEmployeeId ? `${API_URL}/${encodeURIComponent(editingEmployeeId)}` : API_URL, {
        method: editingEmployeeId ? "PUT" : "POST",
        body: JSON.stringify({
          name: employeeName.trim(),
          email: employeeEmail.trim(),
          role: position.trim(),
          department,
        }),
      });

      await fetchEmployees();
      await fetchDashboardStats();

      setEmployeeName("");
      setEmployeeEmail("");
      setPosition("");
      setEditingEmployeeId(null);
      setDepartment("Engineering");
      setShowForm(false);
      setActivePage("Employees");

      showMessage("Employee added successfully!");
    } catch (err) {
      showMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEmployeeEdit(employee) {
    setEditingEmployeeId(employee.id);
    setEmployeeName(employee.name);
    setEmployeeEmail(employee.email || "");
    setPosition(employee.position);
    setDepartment(employee.department);
    setShowForm(true);
  }

  async function handleDeleteEmployee(id) {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete this employee?"
      )
    ) {
      return;
    }

    try {
      await apiRequest(`${API_URL}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      setEmployees((previous) =>
        previous.filter((employee) => employee.id !== id)
      );

      setAttendanceRecords((previous) =>
        previous.filter(
          (record) => String(record.employeeId) !== String(id)
        )
      );

      setAttendanceDrafts((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });

      await fetchDashboardStats();
      showMessage("Employee deleted successfully.");
    } catch (err) {
      showMessage(err.message);
    }
  }

  // ATTENDANCE
  async function fetchAttendance(date = getTodayDate()) {
    try {
      setAttendanceLoading(true);

      const result = await apiRequest(
        `${ATTENDANCE_API_URL}?date=${encodeURIComponent(date)}`
      );

      const records = result.data || [];
      setAttendanceRecords(records);

      const drafts = {};

      records.forEach((record) => {
        drafts[String(record.employeeId)] = record.status;
      });

      setAttendanceDrafts(drafts);
    } catch (err) {
      showMessage(err.message);
      console.error("Fetch attendance error:", err);
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function handleSaveAttendance(employee) {
    const status = attendanceDrafts[employee.id];

    if (!status) {
      showMessage("Please select an attendance status.");
      return;
    }

    try {
      setAttendanceSavingId(employee.id);

      const result = await apiRequest(ATTENDANCE_API_URL, {
        method: "POST",
        body: JSON.stringify({
          employeeId: employee.id,
          date: attendanceDate,
          status,
        }),
      });

      setAttendanceRecords((previous) => {
        const exists = previous.some(
          (record) =>
            String(record.employeeId) === employee.id &&
            record.date === attendanceDate
        );

        return exists
          ? previous.map((record) =>
              String(record.employeeId) === employee.id &&
              record.date === attendanceDate
                ? result.data
                : record
            )
          : [...previous, result.data];
      });

      await fetchDashboardStats();
      showMessage(`${employee.name}: attendance saved successfully!`);
    } catch (err) {
      showMessage(err.message);
    } finally {
      setAttendanceSavingId(null);
    }
  }

  // LEAVE MANAGEMENT
  async function fetchLeaves() {
    try {
      const result = await apiRequest(LEAVES_API_URL);
      setLeaves(result.data || []);
    } catch (err) {
      showMessage(`Unable to load leaves: ${err.message}`);
      console.error("Fetch leaves error:", err);
    }
  }

  async function handleSubmitLeave(event) {
    event.preventDefault();

    if (!leaveEmployeeId) {
      showMessage("Please select an employee.");
      return;
    }

    if (leaveEndDate < leaveStartDate) {
      showMessage("End date cannot be earlier than start date.");
      return;
    }

    const employee = employees.find(
      (item) => item.id === leaveEmployeeId
    );

    if (!employee) {
      showMessage("Please select a valid employee.");
      return;
    }

    const dates =
      leaveStartDate === leaveEndDate
        ? leaveStartDate
        : `${leaveStartDate} - ${leaveEndDate}`;

    try {
      setLeaveSaving(true);

      await apiRequest(LEAVES_API_URL, {
        method: "POST",
        body: JSON.stringify({
          employeeId: employee.id,
          name: employee.name,
          type: leaveType,
          dates,
          reason: leaveReason.trim(),
        }),
      });

      await fetchLeaves();
      await fetchDashboardStats();

      setShowLeaveForm(false);
      setLeaveReason("");
      setLeaveStartDate(getTodayDate());
      setLeaveEndDate(getTodayDate());

      showMessage("Leave request saved successfully!");
    } catch (err) {
      showMessage(err.message);
    } finally {
      setLeaveSaving(false);
    }
  }

  async function handleLeaveStatus(id, newStatus) {
    try {
      await apiRequest(`${LEAVES_API_URL}/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });

      await fetchLeaves();
      await fetchDashboardStats();

      showMessage(
        `Leave request ${newStatus.toLowerCase()} successfully.`
      );
    } catch (err) {
      showMessage(err.message);
    }
  }

  // ANNOUNCEMENTS
  async function fetchAnnouncements() {
    try {
      setAnnouncementLoading(true);

      const result = await apiRequest(ANNOUNCEMENTS_API_URL);
      setAnnouncements(result.data || []);
    } catch (err) {
      console.error("Fetch announcements error:", err);
      showMessage(`Unable to load announcements: ${err.message}`);
    } finally {
      setAnnouncementLoading(false);
    }
  }

  async function handleAddAnnouncement(event) {
    event.preventDefault();

    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      showMessage("Please enter the announcement title and message.");
      return;
    }

    try {
      setAnnouncementSaving(true);

      await apiRequest(editingAnnouncementId ? `${ANNOUNCEMENTS_API_URL}/${encodeURIComponent(editingAnnouncementId)}` : ANNOUNCEMENTS_API_URL, {
        method: editingAnnouncementId ? "PUT" : "POST",
        body: JSON.stringify({
          title: announcementTitle.trim(),
          message: announcementMessage.trim(),
          createdBy: currentUser?.name || role,
        }),
      });

      await fetchAnnouncements();
      await fetchDashboardStats();

      setAnnouncementTitle("");
      setAnnouncementMessage("");
      setEditingAnnouncementId(null);
      setShowAnnouncementForm(false);

      showMessage(editingAnnouncementId ? "Announcement updated successfully!" : "Announcement published successfully!");
    } catch (err) {
      showMessage(`Unable to publish announcement: ${err.message}`);
    } finally {
      setAnnouncementSaving(false);
    }
  }

  function startAnnouncementEdit(announcement) {
    setEditingAnnouncementId(announcement._id);
    setAnnouncementTitle(announcement.title);
    setAnnouncementMessage(announcement.message);
    setShowAnnouncementForm(true);
  }

  function cancelAnnouncementForm() {
    setShowAnnouncementForm(false);
    setEditingAnnouncementId(null);
    setAnnouncementTitle("");
    setAnnouncementMessage("");
  }

  async function handleDeleteAnnouncement(id) {
    if (!window.confirm("Delete this announcement permanently?")) {
      return;
    }

    try {
      await apiRequest(
        `${ANNOUNCEMENTS_API_URL}/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      await fetchAnnouncements();
      await fetchDashboardStats();

      showMessage("Announcement deleted successfully.");
    } catch (err) {
      showMessage(`Unable to delete announcement: ${err.message}`);
    }
  }

  // TRAINING
  async function fetchTrainings() {
    try {
      setTrainingLoading(true);

      const result = await apiRequest(TRAINING_API_URL);
      setTrainings(result.data || []);
    } catch (err) {
      console.error("Fetch training error:", err);
      showMessage(`Unable to load training sessions: ${err.message}`);
    } finally {
      setTrainingLoading(false);
    }
  }

  async function handleAddTraining(event) {
    event.preventDefault();

    if (
      !trainingTitle.trim() ||
      !trainingTrainer.trim() ||
      !trainingDate
    ) {
      showMessage("Please enter the training title, trainer and date.");
      return;
    }

    try {
      setTrainingSaving(true);

      await apiRequest(editingTrainingId ? `${TRAINING_API_URL}/${encodeURIComponent(editingTrainingId)}` : TRAINING_API_URL, {
        method: editingTrainingId ? "PUT" : "POST",
        body: JSON.stringify({
          title: trainingTitle.trim(),
          description: trainingDescription.trim(),
          trainer: trainingTrainer.trim(),
          date: trainingDate,
          time: trainingTime,
          duration: trainingDuration.trim(),
          mode: trainingMode,
          createdBy: currentUser?.name || role,
        }),
      });

      await fetchTrainings();
      await fetchDashboardStats();

      setTrainingTitle("");
      setTrainingDescription("");
      setTrainingTrainer("");
      setTrainingDate(getTodayDate());
      setTrainingTime("");
      setTrainingDuration("");
      setTrainingMode("Online");
      setEditingTrainingId(null);
      setShowTrainingForm(false);

      showMessage(editingTrainingId ? "Training session updated successfully!" : "Training session added successfully!");
    } catch (err) {
      showMessage(`Unable to add training: ${err.message}`);
    } finally {
      setTrainingSaving(false);
    }
  }

  function startTrainingEdit(training) {
    setEditingTrainingId(training._id);
    setTrainingTitle(training.title || "");
    setTrainingDescription(training.description || "");
    setTrainingTrainer(training.trainer || "");
    setTrainingDate(training.date || getTodayDate());
    setTrainingTime(training.time || "");
    setTrainingDuration(training.duration || "");
    setTrainingMode(training.mode || "Online");
    setShowTrainingForm(true);
  }

  function cancelTrainingForm() {
    setShowTrainingForm(false);
    setEditingTrainingId(null);
    setTrainingTitle("");
    setTrainingDescription("");
    setTrainingTrainer("");
    setTrainingDate(getTodayDate());
    setTrainingTime("");
    setTrainingDuration("");
    setTrainingMode("Online");
  }

  async function handleDeleteTraining(id) {
    if (!window.confirm("Delete this training session permanently?")) {
      return;
    }

    try {
      await apiRequest(
        `${TRAINING_API_URL}/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      await fetchTrainings();
      await fetchDashboardStats();

      showMessage("Training session deleted successfully.");
    } catch (err) {
      showMessage(`Unable to delete training: ${err.message}`);
    }
  }

  // DASHBOARD STATISTICS
  async function fetchDashboardStats() {
    try {
      const result = await apiRequest(
        `${DASHBOARD_API_URL}?date=${getTodayDate()}`
      );

      setDashboardStats((previous) => ({
        ...previous,
        ...result.data,
      }));
    } catch (err) {
      console.error("Dashboard stats error:", err);
    }
  }

  // LOAD DATA ONLY AFTER LOGIN
  useEffect(() => {
    if (authPage !== "app") return;

    fetchEmployees();
    fetchLeaves();
    fetchDashboardStats();
    fetchAnnouncements();
    fetchTrainings();
  }, [authPage]);

  // LOAD ATTENDANCE WHEN NEEDED
  useEffect(() => {
    if (authPage !== "app") return;

    if (
      activePage === "Attendance" ||
      activePage === "My Attendance" ||
      activePage === "Dashboard"
    ) {
      fetchAttendance(
        activePage === "Dashboard" ? getTodayDate() : attendanceDate
      );
    }
  }, [authPage, activePage, attendanceDate]);

  const pendingLeaves = leaves.filter(
    (leave) => leave.status === "Pending"
  ).length;

  const filteredEmployees = employees.filter((employee) =>
    `${employee.name} ${employee.department} ${employee.position}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // EMPLOYEE FORM
  function renderEmployeeForm() {
    return (
      <form className="employee-form" onSubmit={handleAddEmployee}>
        <label htmlFor="employeeName">Employee name</label>
        <input
          id="employeeName"
          value={employeeName}
          onChange={(event) => setEmployeeName(event.target.value)}
          placeholder="Enter employee name"
          required
        />

        <label htmlFor="employeeEmail">Employee email (for account linking)</label>
        <input
          id="employeeEmail"
          type="email"
          value={employeeEmail}
          onChange={(event) => setEmployeeEmail(event.target.value)}
          placeholder="employee@company.com"
        />

        <label htmlFor="employeePosition">Job position</label>
        <input
          id="employeePosition"
          value={position}
          onChange={(event) => setPosition(event.target.value)}
          placeholder="e.g. Software Engineer"
          required
        />

        <label htmlFor="employeeDepartment">Department</label>
        <select
          id="employeeDepartment"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
        >
          <option>Engineering</option>
          <option>Human Resources</option>
          <option>Design</option>
          <option>Marketing</option>
          <option>Finance</option>
        </select>

        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Saving..." : editingEmployeeId ? "Update Employee" : "Save Employee"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setShowForm(false);
              setEditingEmployeeId(null);
              setEmployeeName("");
              setEmployeeEmail("");
              setPosition("");
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  // LEAVE APPLICATION FORM
  function renderLeaveForm() {
    return (
      <form className="employee-form" onSubmit={handleSubmitLeave}>
        <label htmlFor="leaveEmployee">Employee</label>
        <select
          id="leaveEmployee"
          value={leaveEmployeeId}
          onChange={(event) => setLeaveEmployeeId(event.target.value)}
          required
        >
          <option value="">Select employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} — {employee.department}
            </option>
          ))}
        </select>

        <label htmlFor="leaveType">Leave type</label>
        <select
          id="leaveType"
          value={leaveType}
          onChange={(event) => setLeaveType(event.target.value)}
        >
          <option>Casual Leave</option>
          <option>Sick Leave</option>
          <option>Personal Leave</option>
          <option>Annual Leave</option>
          <option>Emergency Leave</option>
        </select>

        <label htmlFor="leaveStart">Start date</label>
        <input
          id="leaveStart"
          type="date"
          value={leaveStartDate}
          onChange={(event) => setLeaveStartDate(event.target.value)}
          required
        />

        <label htmlFor="leaveEnd">End date</label>
        <input
          id="leaveEnd"
          type="date"
          min={leaveStartDate}
          value={leaveEndDate}
          onChange={(event) => setLeaveEndDate(event.target.value)}
          required
        />

        <label htmlFor="leaveReason">Reason</label>
        <textarea
          id="leaveReason"
          value={leaveReason}
          onChange={(event) => setLeaveReason(event.target.value)}
          placeholder="Enter reason for leave (optional)"
          rows={3}
        />

        <div className="form-actions">
          <button
            className="primary-button"
            type="submit"
            disabled={leaveSaving || employees.length === 0}
          >
            {leaveSaving ? "Submitting..." : "Submit Request"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setShowLeaveForm(false)}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  // EMPLOYEE TABLE
  function renderEmployeeTable(showPosition = false) {
    return (
      <>
        <div className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search employees"
            placeholder="Search employees..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>EMPLOYEE</th>
                <th>DEPARTMENT</th>
                {showPosition && <th>POSITION</th>}
                <th>ATTENDANCE</th>
                {role === "HR" && <th>ACTION</th>}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => {
                const record = attendanceRecords.find(
                  (item) =>
                    String(item.employeeId) === employee.id &&
                    item.date === getTodayDate()
                );

                return (
                  <tr key={employee.id}>
                    <td>
                      <div className="employee-cell">
                        <div className="avatar">
                          {employee.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{employee.name}</strong>
                          {!showPosition && <span>{employee.position}</span>}
                        </div>
                      </div>
                    </td>
                    <td>{employee.department}</td>
                    {showPosition && <td>{employee.position}</td>}
                    <td>
                      <span
                        className={`status ${
                          record?.status === "Present"
                            ? "status-approved"
                            : record?.status === "Absent"
                              ? "status-rejected"
                              : "status-pending"
                        }`}
                      >
                        {record?.status || "Not marked"}
                      </span>
                    </td>
                    {role === "HR" && (
                      <td>
                        <button className="link-button" onClick={() => startEmployeeEdit(employee)}>
                          Edit
                        </button>{" "}
                        <button
                          className="text-button"
                          onClick={() => handleDeleteEmployee(employee.id)}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}

              {!loading && filteredEmployees.length === 0 && (
                <tr>
                  <td
                    colSpan={
                      (showPosition ? 4 : 3) + (role === "HR" ? 1 : 0)
                    }
                  >
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // DASHBOARD
  function renderDashboard() {
    return (
      <>
        <section className="welcome-banner">
          <div>
            <span className="eyebrow">STAFFSYNC WORKSPACE</span>
            <h2>Good evening, {currentUser?.name || role}!</h2>
            <p>
              Here is an overview of your workplace and today's activities.
            </p>
          </div>
          <div className="banner-icon" aria-hidden="true">✦</div>
        </section>

        <section className="stats-grid">
          <StatCard
            icon="♙"
            label={role === "Manager" ? "Team Members" : "Total Employees"}
            value={dashboardStats.totalEmployees}
            color="purple"
            detail="Live employee records"
          />
          <StatCard
            icon="◷"
            label="Present Today"
            value={dashboardStats.presentToday}
            color="green"
            detail="Saved attendance records"
          />
          <StatCard
            icon="▤"
            label="Pending Leaves"
            value={pendingLeaves}
            color="orange"
            detail="Awaiting review"
          />
          <StatCard
            icon="◉"
            label="Announcements"
            value={announcements.length}
            color="blue"
            detail="Live workplace updates"
          />
        </section>

        <section className="content-grid">
          <div className="panel employee-panel">
            <div className="panel-header">
              <div>
                <h3>Employees</h3>
                <p>Employee records and current status</p>
              </div>
              {role === "HR" && (
                <button
                  className="primary-button"
                  onClick={() => setShowForm((previous) => !previous)}
                >
                  + Add Employee
                </button>
              )}
            </div>
            {showForm && role === "HR" && renderEmployeeForm()}
            {loading ? <p>Loading employees...</p> : renderEmployeeTable()}
          </div>

          <div className="panel leave-panel">
            <div className="panel-header">
              <div>
                <h3>Leave Requests</h3>
                <p>Recent leave applications</p>
              </div>
              <button
                className="link-button"
                onClick={() =>
                  setActivePage(
                    role === "Employee" ? "My Leaves" : "Leave Requests"
                  )
                }
              >
                View all →
              </button>
            </div>

            <div className="leave-list">
              {leaves.slice(0, 4).map((leave) => (
                <div className="leave-item" key={leave._id}>
                  <div className="leave-avatar">
                    {(leave.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="leave-details">
                    <strong>{leave.name}</strong>
                    <span>{leave.type}</span>
                    <small>{leave.dates}</small>
                  </div>
                  <div className="leave-actions">
                    <span
                      className={`status ${
                        leave.status === "Approved"
                          ? "status-approved"
                          : leave.status === "Rejected"
                            ? "status-rejected"
                            : "status-pending"
                      }`}
                    >
                      {leave.status}
                    </span>
                    {role !== "Employee" && leave.status === "Pending" && (
                      <div className="decision-buttons">
                        <button
                          className="approve-button"
                          onClick={() =>
                            handleLeaveStatus(leave._id, "Approved")
                          }
                          aria-label="Approve leave"
                        >
                          ✓
                        </button>
                        <button
                          className="reject-button"
                          onClick={() =>
                            handleLeaveStatus(leave._id, "Rejected")
                          }
                          aria-label="Reject leave"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {leaves.length === 0 && <p>No leave requests yet.</p>}
            </div>

            {role === "Employee" && (
              <button
                className="primary-button full-button"
                onClick={() => {
                  setLeaveEmployeeId("");
                  setShowLeaveForm(true);
                  setActivePage("My Leaves");
                }}
              >
                + Apply for Leave
              </button>
            )}
          </div>
        </section>

        <section className="panel announcement-panel">
          <div className="panel-header">
            <div>
              <h3>Recent Announcements</h3>
              <p>Updates from your organization</p>
            </div>
            <button
              className="link-button"
              onClick={() => setActivePage("Announcements")}
            >
              View all →
            </button>
          </div>

          {announcements.length === 0 ? (
            <p>No announcements published yet.</p>
          ) : (
            <div className="announcement-grid">
              {announcements.slice(0, 3).map((announcement) => (
                <Announcement
                  key={announcement._id}
                  icon="📢"
                  title={announcement.title}
                  description={announcement.message}
                  date={formatDate(announcement.createdAt)}
                />
              ))}
            </div>
          )}
        </section>
      </>
    );
  }

  // EMPLOYEE DIRECTORY
  function renderEmployees() {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Employee Directory</h3>
            <p>Manage and review employee information.</p>
          </div>
          {role === "HR" && (
            <button
              className="primary-button"
              onClick={() => setShowForm((previous) => !previous)}
            >
              + Add Employee
            </button>
          )}
        </div>
        {showForm && role === "HR" && renderEmployeeForm()}
        {loading ? <p>Loading employees...</p> : renderEmployeeTable(true)}
      </section>
    );
  }

  // LEAVE REQUESTS PAGE
  function renderLeaves() {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Leave Management</h3>
            <p>Submit, review and manage leave applications.</p>
          </div>
          <span className="status status-pending">{pendingLeaves} Pending</span>
        </div>

        {showLeaveForm && renderLeaveForm()}

        {role === "Employee" && !showLeaveForm && (
          <button
            className="primary-button"
            onClick={() => setShowLeaveForm(true)}
          >
            + Apply for Leave
          </button>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>EMPLOYEE</th>
                <th>LEAVE TYPE</th>
                <th>DATES</th>
                <th>REASON</th>
                <th>STATUS</th>
                {role !== "Employee" && <th>DECISION</th>}
              </tr>
            </thead>
            <tbody>
              {leaves.map((leave) => (
                <tr key={leave._id}>
                  <td>{leave.name}</td>
                  <td>{leave.type}</td>
                  <td>{leave.dates}</td>
                  <td>{leave.reason || "—"}</td>
                  <td>
                    <span
                      className={`status ${
                        leave.status === "Approved"
                          ? "status-approved"
                          : leave.status === "Rejected"
                            ? "status-rejected"
                            : "status-pending"
                      }`}
                    >
                      {leave.status}
                    </span>
                  </td>
                  {role !== "Employee" && (
                    <td>
                      {leave.status === "Pending" ? (
                        <div className="form-actions">
                          <button
                            className="approve-button"
                            onClick={() =>
                              handleLeaveStatus(leave._id, "Approved")
                            }
                          >
                            Approve
                          </button>
                          <button
                            className="reject-button"
                            onClick={() =>
                              handleLeaveStatus(leave._id, "Rejected")
                            }
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        "Completed"
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {leaves.length === 0 && (
                <tr>
                  <td colSpan={role === "Employee" ? 5 : 6}>
                    No leave requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  // ATTENDANCE PAGE
  function renderAttendance() {
    const presentCount = attendanceRecords.filter(
      (record) =>
        record.status === "Present" && record.date === attendanceDate
    ).length;

    const absentCount = attendanceRecords.filter(
      (record) =>
        record.status === "Absent" && record.date === attendanceDate
    ).length;

    const leaveCount = attendanceRecords.filter(
      (record) =>
        record.status === "Leave" && record.date === attendanceDate
    ).length;

    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Attendance Management</h3>
            <p>Mark and manage daily employee attendance.</p>
          </div>
          <label>
            Attendance Date
            <input
              type="date"
              value={attendanceDate}
              onChange={(event) => setAttendanceDate(event.target.value)}
            />
          </label>
        </div>

        <section className="stats-grid">
          <StatCard
            icon="✓"
            label="Present"
            value={presentCount}
            color="green"
            detail="Marked present"
          />
          <StatCard
            icon="×"
            label="Absent"
            value={absentCount}
            color="orange"
            detail="Marked absent"
          />
          <StatCard
            icon="▤"
            label="On Leave"
            value={leaveCount}
            color="blue"
            detail="Marked on leave"
          />
        </section>

        {attendanceLoading || loading ? (
          <p>Loading attendance...</p>
        ) : employees.length === 0 ? (
          <p>No employees available. Add an employee first.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>DEPARTMENT</th>
                  <th>STATUS</th>
                  {role !== "Employee" && <th>ACTION</th>}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => {
                  const savedRecord = attendanceRecords.find(
                    (record) =>
                      String(record.employeeId) === employee.id &&
                      record.date === attendanceDate
                  );

                  return (
                    <tr key={employee.id}>
                      <td>
                        <div className="employee-cell">
                          <div className="avatar">
                            {employee.name.charAt(0).toUpperCase()}
                          </div>
                          <strong>{employee.name}</strong>
                        </div>
                      </td>
                      <td>{employee.department}</td>
                      {role === "Employee" ? <td>{savedRecord?.status || "Not marked"}</td> : <>
                      <td>
                        <select
                          value={attendanceDrafts[employee.id] || ""}
                          onChange={(event) => setAttendanceDrafts((previous) => ({ ...previous, [employee.id]: event.target.value }))}
                        >
                          <option value="">Select status</option>
                          <option value="Present">Present</option>
                          <option value="Absent">Absent</option>
                          <option value="Leave">Leave</option>
                        </select>
                      </td>
                      <td>
                        <button
                          className="primary-button"
                          disabled={attendanceSavingId === employee.id}
                          onClick={() => handleSaveAttendance(employee)}
                        >
                          {attendanceSavingId === employee.id
                            ? "Saving..."
                            : savedRecord
                              ? "Update"
                              : "Save"}
                        </button>
                      </td>
                      </>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="helper-text">
          Attendance is saved by employee and date in MongoDB.
        </p>
      </section>
    );
  }

  // ANNOUNCEMENTS PAGE
  function renderAnnouncements() {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Workplace Announcements</h3>
            <p>Publish and view important organization updates.</p>
          </div>

          {role === "HR" && (
            <button
              className="primary-button"
              onClick={() => showAnnouncementForm ? cancelAnnouncementForm() : setShowAnnouncementForm(true)}
            >
              {showAnnouncementForm ? "Cancel" : "+ Add Announcement"}
            </button>
          )}
        </div>

        {showAnnouncementForm && role === "HR" && (
          <form className="employee-form" onSubmit={handleAddAnnouncement}>
            <label htmlFor="announcementTitle">Announcement title</label>
            <input
              id="announcementTitle"
              value={announcementTitle}
              onChange={(event) => setAnnouncementTitle(event.target.value)}
              placeholder="e.g. Monthly Team Meeting"
              maxLength={150}
              required
            />

            <label htmlFor="announcementMessage">Announcement message</label>
            <textarea
              id="announcementMessage"
              value={announcementMessage}
              onChange={(event) =>
                setAnnouncementMessage(event.target.value)
              }
              placeholder="Write the announcement details..."
              rows={4}
              required
            />

            <div className="form-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={announcementSaving}
              >
                {announcementSaving ? "Saving..." : editingAnnouncementId ? "Save Changes" : "Publish Announcement"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setShowAnnouncementForm(false);
                  setEditingAnnouncementId(null);
                  setAnnouncementTitle("");
                  setAnnouncementMessage("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="panel-header">
          <div>
            <h3>Published Updates</h3>
            <p>{announcements.length} announcement(s)</p>
          </div>
          <button
            className="secondary-button"
            onClick={fetchAnnouncements}
            disabled={announcementLoading}
          >
            {announcementLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {announcementLoading && announcements.length === 0 ? (
          <p>Loading announcements...</p>
        ) : announcements.length === 0 ? (
          <p>No announcements published yet.</p>
        ) : (
          <div className="announcement-grid">
            {announcements.map((announcement) => (
              <article className="announcement-card" key={announcement._id}>
                <div className="announcement-icon">📢</div>
                <h4>{announcement.title}</h4>
                <p>{announcement.message}</p>
                <span className="announcement-date">
                  Published: {formatDate(announcement.createdAt)}
                </span>
                <p className="helper-text">
                  Posted by: {announcement.createdBy || "HR"}
                </p>
                {role === "HR" && (
                  <button className="link-button" onClick={() => startAnnouncementEdit(announcement)}>
                    Edit announcement
                  </button>
                )}
                {role === "HR" && (
                  <button
                    className="text-button"
                    onClick={() =>
                      handleDeleteAnnouncement(announcement._id)
                    }
                  >
                    Delete announcement
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  // TRAINING PAGE
  function renderTraining() {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Training & Development</h3>
            <p>Organize learning sessions and explore training programs.</p>
          </div>
          {(role === "HR" || role === "Manager") && (
            <button
              className="primary-button"
                onClick={() => showTrainingForm ? cancelTrainingForm() : setShowTrainingForm(true)}
            >
              {showTrainingForm ? "Cancel" : "+ Add Training"}
            </button>
          )}
        </div>

        {showTrainingForm && (role === "HR" || role === "Manager") && (
          <form className="employee-form" onSubmit={handleAddTraining}>
            <label htmlFor="trainingTitle">Training title</label>
            <input
              id="trainingTitle"
              value={trainingTitle}
              onChange={(event) => setTrainingTitle(event.target.value)}
              placeholder="e.g. Communication Skills Workshop"
              required
            />

            <label htmlFor="trainingDescription">Description</label>
            <textarea
              id="trainingDescription"
              value={trainingDescription}
              onChange={(event) =>
                setTrainingDescription(event.target.value)
              }
              placeholder="Describe the training session..."
              rows={3}
            />

            <label htmlFor="trainingTrainer">Trainer</label>
            <input
              id="trainingTrainer"
              value={trainingTrainer}
              onChange={(event) => setTrainingTrainer(event.target.value)}
              placeholder="Enter trainer name"
              required
            />

            <label htmlFor="trainingDate">Training date</label>
            <input
              id="trainingDate"
              type="date"
              value={trainingDate}
              onChange={(event) => setTrainingDate(event.target.value)}
              required
            />

            <label htmlFor="trainingTime">Training time</label>
            <input
              id="trainingTime"
              type="time"
              value={trainingTime}
              onChange={(event) => setTrainingTime(event.target.value)}
            />

            <label htmlFor="trainingDuration">Duration</label>
            <input
              id="trainingDuration"
              value={trainingDuration}
              onChange={(event) => setTrainingDuration(event.target.value)}
              placeholder="e.g. 2 hours"
            />

            <label htmlFor="trainingMode">Training mode</label>
            <select
              id="trainingMode"
              value={trainingMode}
              onChange={(event) => setTrainingMode(event.target.value)}
            >
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
            </select>

            <div className="form-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={trainingSaving}
              >
                {trainingSaving ? "Saving..." : editingTrainingId ? "Save Changes" : "Save Training"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setShowTrainingForm(false);
                  setEditingTrainingId(null);
                  setTrainingTitle("");
                  setTrainingDescription("");
                  setTrainingTrainer("");
                  setTrainingDate(getTodayDate());
                  setTrainingTime("");
                  setTrainingDuration("");
                  setTrainingMode("Online");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="panel-header">
          <div>
            <h3>Available Training Sessions</h3>
            <p>{trainings.length} training session(s)</p>
          </div>
          <button
            className="secondary-button"
            onClick={fetchTrainings}
            disabled={trainingLoading}
          >
            {trainingLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {trainingLoading && trainings.length === 0 ? (
          <p>Loading training sessions...</p>
        ) : trainings.length === 0 ? (
          <p>No training sessions available yet.</p>
        ) : (
          <div className="announcement-grid">
            {trainings.map((training) => (
              <article className="announcement-card" key={training._id}>
                <div className="announcement-icon">🎓</div>
                <h4>{training.title}</h4>
                <p>
                  {training.description || "Training and development session."}
                </p>
                <p>
                  <strong>Trainer:</strong> {training.trainer}
                </p>
                <p>
                  <strong>Date:</strong> {formatDate(training.date)}
                </p>
                {training.time && (
                  <p>
                    <strong>Time:</strong> {training.time}
                  </p>
                )}
                {training.duration && (
                  <p>
                    <strong>Duration:</strong> {training.duration}
                  </p>
                )}
                <p>
                  <strong>Mode:</strong> {training.mode || "Online"}
                </p>
                {(role === "HR" || role === "Manager") && (
                  <button className="link-button" onClick={() => startTrainingEdit(training)}>
                    Edit training
                  </button>
                )}
                {(role === "HR" || role === "Manager") && (
                  <button
                    className="text-button"
                    onClick={() => handleDeleteTraining(training._id)}
                  >
                    Delete training
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  // OTHER PAGES
  function renderOtherPage() {
    if (activePage === "My Profile") {
      return (
        <section className="panel other-page">
          <div className="panel-header">
            <div>
              <h3>My Profile</h3>
              <p>Keep your account contact details up to date.</p>
            </div>
          </div>
          <form className="employee-form" onSubmit={handleSaveProfile}>
            <label htmlFor="profileName">Full name</label>
            <input id="profileName" value={profileName} onChange={(event) => setProfileName(event.target.value)} required />
            <label htmlFor="profileEmail">Email address</label>
            <input id="profileEmail" type="email" value={currentUser?.email || ""} readOnly />
            <label htmlFor="profilePhone">Phone number</label>
            <input id="profilePhone" type="tel" value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} maxLength={30} />
            <p>Role: {role} · Position: {employees[0]?.position || "Not linked"} · Department: {employees[0]?.department || "Not linked"}</p>
            <button className="primary-button" type="submit" disabled={profileSaving}>
              {profileSaving ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </section>
      );
    }

    return (
      <section className="panel">
        <h3>{activePage}</h3>
        <p>This section is not connected yet.</p>
      </section>
    );
  }

  // CORRECT PAGE ROUTING
  function renderPageContent() {
    if (activePage === "Dashboard") return renderDashboard();

    if (activePage === "Employees" || activePage === "Team Members") {
      return renderEmployees();
    }

    if (activePage === "Leave Requests" || activePage === "My Leaves") {
      return renderLeaves();
    }

    if (activePage === "Attendance" || activePage === "My Attendance") {
      return renderAttendance();
    }

    if (activePage === "Announcements") return renderAnnouncements();

    if (activePage === "Training") return renderTraining();

    return renderOtherPage();
  }

  // LOGIN AND SIGNUP MUST BE OUTSIDE THE DASHBOARD LAYOUT
  if (authPage === "login") {
    return (
      <Login
        onLogin={handleLogin}
        onSwitchToSignup={() => setAuthPage("signup")}
      />
    );
  }

  if (authPage === "signup") {
    return (
      <Signup
        onSwitchToLogin={() => setAuthPage("login")}
        onSignupSuccess={handleSignupSuccess}
      />
    );
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <h1>StaffSync</h1>
            <span>PEOPLE MANAGEMENT</span>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {(navigation[role] || navigation.Employee).map((item) => (
            <button
              key={item.name}
              className={`nav-item ${
                activePage === item.name ? "active" : ""
              }`}
              onClick={() => {
                setActivePage(item.name);
                setShowForm(false);
                setShowLeaveForm(false);
                setShowAnnouncementForm(false);
                setShowTrainingForm(false);
                setSearch("");
              }}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.name}</span>
              {item.name === "Leave Requests" && pendingLeaves > 0 && (
                <span className="nav-badge">{pendingLeaves}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">?</div>
            <strong>Need help?</strong>
            <p>Contact your HR team for assistance.</p>
            <button
              onClick={() =>
                showMessage("Contact your organization's HR administrator.")
              }
            >
              Get Support →
            </button>
          </div>

          <div className="sidebar-footer">
            <div className="avatar profile-avatar">
              {(currentUser?.name || role).charAt(0).toUpperCase()}
            </div>
            <div className="profile-info">
              <strong>{currentUser?.name || "User"}</strong>
              <span>{role} Workspace</span>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-actions">
            <div className="role-switcher">
              <span>Signed in as</span>
              <strong>{currentUser?.name || "User"}</strong>
              <span>{role}</span>
            </div>

            <button
              className="secondary-button"
              onClick={handleLogout}
            >
              Logout
            </button>

            <button
              className="notification-button"
              aria-label="Notifications"
              onClick={() =>
                showMessage(
                  `You have ${pendingLeaves} pending leave requests.`
                )
              }
            >
              ♧
              {pendingLeaves > 0 && <span className="notification-dot" />}
            </button>

            <div className="avatar topbar-avatar">
              {(currentUser?.name || role).charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <h1>{activePage}</h1>
              <p>Manage your people, attendance and workplace activities.</p>
            </div>
            <div className="date-chip">
              <span aria-hidden="true">▦</span>
              {new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>

          {error && (
            <div className="toast-message" role="alert">
              Unable to load employees: {error}
              <button onClick={fetchEmployees}>Retry</button>
            </div>
          )}

          {notice && (
            <div className="toast-message" role="status">
              <span>✓</span>
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}

          {renderPageContent()}

          <footer className="page-footer">
            <span>© 2026 StaffSync</span>
            <span>People first. Progress together.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color, detail }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="stat-information">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        <span className="stat-detail">{detail}</span>
      </div>
      <span className="stat-decoration" aria-hidden="true">
        ↗
      </span>
    </div>
  );
}

function Announcement({ icon, title, description, date }) {
  return (
    <article className="announcement-card">
      <div className="announcement-icon">{icon}</div>
      <h4>{title}</h4>
      <p>{description}</p>
      <span className="announcement-date">{date}</span>
    </article>
  );
}

export default App;
