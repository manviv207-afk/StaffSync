
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const {
  authenticateToken,
  allowRoles,
} = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== MIDDLEWARE ====================

const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("This website is not allowed to access the StaffSync API."));
  },
}));
app.use(express.json());

// ==================== PUBLIC ROUTES ====================

// Home
app.get("/", (req, res) => {
  res.json({ message: "StaffSync Backend is running!" });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "StaffSync API is working!",
  });
});

// Test routes
app.get("/api/auth/test", (req, res) => {
  res.status(200).send("STAFFSYNC AUTH TEST 123");
});

app.get("/test-route", (req, res) => {
  res.status(200).send("NEW SERVER ROUTE WORKS");
});

// Login and signup remain public
app.use("/api/auth", authRoutes);

// ==================== MODELS ====================

const Employee = mongoose.model(
  "Employee",
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      role: {
        type: String,
        required: true,
        trim: true,
      },
      department: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        lowercase: true,
        trim: true,
        sparse: true,
        unique: true,
      },
    },
    { collection: "employees" }
  )
);

const Attendance = require("./models/Attendance");
const Leave = require("./models/Leave");
const Announcement = require("./models/Announcement");
const Training = require("./models/Training");

// ==================== PROTECT API ROUTES ====================

// All routes declared below require a valid login token.
// HR/Manager restrictions are added to individual write routes.
app.use("/api", authenticateToken);

// Signed-in users can update their own basic profile details.
app.put("/api/profile", async (req, res) => {
  try {
    const { name, phone = "" } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Name is required." });
    }
    if (typeof phone !== "string" || phone.length > 30) {
      return res.status(400).json({ success: false, message: "Enter a valid phone number." });
    }
    const User = mongoose.model("User");
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name: name.trim(), phone: phone.trim() },
      { new: true, runValidators: true }
    ).select("name email role phone employeeId");
    if (user.employeeId) {
      await Employee.findByIdAndUpdate(user.employeeId, { name: user.name });
    }
    res.json({
      success: true,
      message: "Profile updated successfully!",
      data: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update profile", error: error.message });
  }
});

// ==================== EMPLOYEES ====================

// Any logged-in user can view the employee list
app.get("/api/employees", async (req, res) => {
  try {
    const filter = req.user.role === "Employee"
      ? { _id: req.user.employeeId || null }
      : {};
    const employees = await Employee.find(filter).sort({ name: 1 });

    res.json({
      success: true,
      count: employees.length,
      data: employees,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
      error: error.message,
    });
  }
});

// Only HR can add employees
app.post(
  "/api/employees",
  allowRoles("HR"),
  async (req, res) => {
    try {
      const { name, role, department, email } = req.body;

      if (!name?.trim() || !role?.trim() || !department?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name, role and department are required.",
        });
      }

      const employee = await Employee.create({
        name: name.trim(),
        role: role.trim(),
        department: department.trim(),
        ...(email?.trim() ? { email: email.trim().toLowerCase() } : {}),
      });

      if (employee.email) {
        await mongoose.model("User").findOneAndUpdate(
          { email: employee.email, role: "Employee" },
          { employeeId: employee._id }
        );
      }

      res.status(201).json({
        success: true,
        message: "Employee added successfully!",
        data: employee,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: "Failed to add employee",
        error: error.message,
      });
    }
  }
);

// Only HR can update employee records
app.put("/api/employees/:id", allowRoles("HR"), async (req, res) => {
  try {
    const { name, role, department, email } = req.body;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid employee ID." });
    }
    if (!name?.trim() || !role?.trim() || !department?.trim()) {
      return res.status(400).json({ success: false, message: "Name, role and department are required." });
    }
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { name: name.trim(), role: role.trim(), department: department.trim(), email: email?.trim()?.toLowerCase() || undefined },
      { new: true, runValidators: true }
    );
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found." });
    const User = mongoose.model("User");
    await User.updateMany({ employeeId: employee._id }, { $unset: { employeeId: 1 } });
    if (employee.email) await User.findOneAndUpdate({ email: employee.email, role: "Employee" }, { employeeId: employee._id });
    res.json({ success: true, message: "Employee updated successfully!", data: employee });
  } catch (error) {
    res.status(400).json({ success: false, message: "Failed to update employee", error: error.message });
  }
});

// Only HR can delete employees
app.delete(
  "/api/employees/:id",
  allowRoles("HR"),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee ID.",
        });
      }

      const employee = await Employee.findByIdAndDelete(req.params.id);

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found.",
        });
      }

      await mongoose.model("User").updateMany(
        { employeeId: employee._id },
        { $unset: { employeeId: 1 } }
      );

      res.json({
        success: true,
        message: "Employee deleted successfully!",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to delete employee",
        error: error.message,
      });
    }
  }
);

// ==================== ATTENDANCE ====================

// Logged-in users can view attendance records
app.get("/api/attendance", async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === "Employee") {
      filter.employeeId = req.user.employeeId || null;
    }

    if (req.query.date) {
      filter.date = req.query.date;
    }

    const records = await Attendance.find(filter).sort({
      date: -1,
      employeeName: 1,
    });

    res.json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch attendance",
      error: error.message,
    });
  }
});

// Only HR and Manager can mark attendance
app.post(
  "/api/attendance",
  allowRoles("HR", "Manager"),
  async (req, res) => {
    try {
      const { employeeId, date, status } = req.body;

      if (
        !employeeId ||
        !mongoose.Types.ObjectId.isValid(employeeId) ||
        !date ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !["Present", "Absent", "Leave"].includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid employeeId, date and status are required.",
        });
      }

      const employee = await Employee.findById(employeeId);

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found.",
        });
      }

      const record = await Attendance.findOneAndUpdate(
        { employeeId, date },
        {
          $set: {
            employeeName: employee.name,
            department: employee.department,
            status,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );

      res.json({
        success: true,
        message: "Attendance saved successfully!",
        data: record,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to save attendance",
        error: error.message,
      });
    }
  }
);

// Only HR and Manager can update attendance
app.put(
  "/api/attendance/:id",
  allowRoles("HR", "Manager"),
  async (req, res) => {
    try {
      const { status } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(req.params.id) ||
        !["Present", "Absent", "Leave"].includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid record ID and status are required.",
        });
      }

      const record = await Attendance.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true, runValidators: true }
      );

      if (!record) {
        return res.status(404).json({
          success: false,
          message: "Attendance record not found.",
        });
      }

      res.json({
        success: true,
        message: "Attendance updated successfully!",
        data: record,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to update attendance",
        error: error.message,
      });
    }
  }
);

// ==================== LEAVE REQUESTS ====================

// Logged-in users can view leave requests.
// Personal record filtering can be added after linking users to employees.
app.get("/api/leaves", async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === "Employee") {
      filter.employeeId = req.user.employeeId || null;
    }

    if (["Pending", "Approved", "Rejected"].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const leaves = await Leave.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: leaves.length,
      data: leaves,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch leave requests",
      error: error.message,
    });
  }
});

// Any logged-in user can submit a leave request
app.post("/api/leaves", async (req, res) => {
  try {
    let { employeeId, name, type, dates, reason } = req.body;

    if (req.user.role === "Employee") {
      if (!req.user.employeeId) {
        return res.status(403).json({ success: false, message: "Ask HR to link your account to an employee record before applying for leave." });
      }
      employeeId = req.user.employeeId.toString();
      const employee = await Employee.findById(employeeId);
      if (!employee) return res.status(404).json({ success: false, message: "Your employee record was not found." });
      name = employee.name;
    }

    if (!name?.trim() || !type?.trim() || !dates?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Employee name, leave type and dates are required.",
      });
    }

    if (employeeId && !mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID.",
      });
    }

    if (employeeId) {
      const employee = await Employee.findById(employeeId);

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee not found.",
        });
      }
    }

    const leave = await Leave.create({
      employeeId: employeeId || null,
      name: name.trim(),
      type: type.trim(),
      dates: dates.trim(),
      reason: reason?.trim() || "",
      status: "Pending",
    });

    res.status(201).json({
      success: true,
      message: "Leave request submitted successfully!",
      data: leave,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to submit leave request",
      error: error.message,
    });
  }
});

// Only HR and Manager can approve/reject leave requests
app.put(
  "/api/leaves/:id",
  allowRoles("HR", "Manager"),
  async (req, res) => {
    try {
      const { status } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(req.params.id) ||
        !["Pending", "Approved", "Rejected"].includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid leave ID and status are required.",
        });
      }

      const leave = await Leave.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true, runValidators: true }
      );

      if (!leave) {
        return res.status(404).json({
          success: false,
          message: "Leave request not found.",
        });
      }

      res.json({
        success: true,
        message: `Leave request ${status.toLowerCase()} successfully!`,
        data: leave,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to update leave request",
        error: error.message,
      });
    }
  }
);

// ==================== ANNOUNCEMENTS ====================

// Any logged-in user can view announcements
app.get("/api/announcements", async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      count: announcements.length,
      data: announcements,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch announcements",
      error: error.message,
    });
  }
});

// Only HR can create announcements
app.post(
  "/api/announcements",
  allowRoles("HR"),
  async (req, res) => {
    try {
      const { title, message } = req.body;

      if (!title?.trim() || !message?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Announcement title and message are required.",
        });
      }

      const announcement = await Announcement.create({
        title: title.trim(),
        message: message.trim(),
        createdBy: req.user.name,
      });

      res.status(201).json({
        success: true,
        message: "Announcement created successfully!",
        data: announcement,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: "Failed to create announcement",
        error: error.message,
      });
    }
  }
);

// Only HR can delete announcements
app.put("/api/announcements/:id", allowRoles("HR"), async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid announcement ID." });
    }
    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, message: "Announcement title and message are required." });
    }
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { title: title.trim(), message: message.trim() },
      { new: true, runValidators: true }
    );
    if (!announcement) return res.status(404).json({ success: false, message: "Announcement not found." });
    res.json({ success: true, message: "Announcement updated successfully!", data: announcement });
  } catch (error) {
    res.status(400).json({ success: false, message: "Failed to update announcement", error: error.message });
  }
});

app.delete(
  "/api/announcements/:id",
  allowRoles("HR"),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid announcement ID.",
        });
      }

      const announcement = await Announcement.findByIdAndDelete(
        req.params.id
      );

      if (!announcement) {
        return res.status(404).json({
          success: false,
          message: "Announcement not found.",
        });
      }

      res.json({
        success: true,
        message: "Announcement deleted successfully!",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to delete announcement",
        error: error.message,
      });
    }
  }
);

// ==================== TRAINING ====================

// Any logged-in user can view training sessions
app.get("/api/trainings", async (req, res) => {
  try {
    const trainings = await Training.find().sort({
      date: 1,
      createdAt: -1,
    });

    res.json({
      success: true,
      count: trainings.length,
      data: trainings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch training sessions",
      error: error.message,
    });
  }
});

// HR and Managers can create training sessions
app.post(
  "/api/trainings",
  allowRoles("HR", "Manager"),
  async (req, res) => {
    try {
      const {
        title,
        description,
        trainer,
        date,
        time,
        duration,
        mode,
      } = req.body;

      if (!title?.trim() || !trainer?.trim() || !date?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Training title, trainer and date are required.",
        });
      }

      if (mode && !["Online", "Offline"].includes(mode)) {
        return res.status(400).json({
          success: false,
          message: "Mode must be Online or Offline.",
        });
      }

      const training = await Training.create({
        title: title.trim(),
        description: description?.trim() || "",
        trainer: trainer.trim(),
        date: date.trim(),
        time: time?.trim() || "",
        duration: duration?.trim() || "",
        mode: mode || "Online",
        createdBy: req.user.name,
      });

      res.status(201).json({
        success: true,
        message: "Training session created successfully!",
        data: training,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: "Failed to create training session",
        error: error.message,
      });
    }
  }
);

// HR and Managers can delete training sessions
app.put("/api/trainings/:id", allowRoles("HR", "Manager"), async (req, res) => {
  try {
    const { title, description, trainer, date, time, duration, mode } = req.body;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid training ID." });
    }
    if (!title?.trim() || !trainer?.trim() || !date?.trim()) {
      return res.status(400).json({ success: false, message: "Training title, trainer and date are required." });
    }
    if (mode && !["Online", "Offline"].includes(mode)) {
      return res.status(400).json({ success: false, message: "Mode must be Online or Offline." });
    }
    const training = await Training.findByIdAndUpdate(
      req.params.id,
      { title: title.trim(), description: description?.trim() || "", trainer: trainer.trim(), date: date.trim(), time: time?.trim() || "", duration: duration?.trim() || "", mode: mode || "Online" },
      { new: true, runValidators: true }
    );
    if (!training) return res.status(404).json({ success: false, message: "Training session not found." });
    res.json({ success: true, message: "Training session updated successfully!", data: training });
  } catch (error) {
    res.status(400).json({ success: false, message: "Failed to update training session", error: error.message });
  }
});

app.delete(
  "/api/trainings/:id",
  allowRoles("HR", "Manager"),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid training ID.",
        });
      }

      const training = await Training.findByIdAndDelete(req.params.id);

      if (!training) {
        return res.status(404).json({
          success: false,
          message: "Training session not found.",
        });
      }

      res.json({
        success: true,
        message: "Training session deleted successfully!",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to delete training session",
        error: error.message,
      });
    }
  }
);

// ==================== DASHBOARD STATISTICS ====================

// Any logged-in user can view dashboard statistics
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const [
      totalEmployees,
      presentToday,
      absentToday,
      onLeaveToday,
      pendingLeaves,
      totalAnnouncements,
      totalTrainings,
    ] = await Promise.all([
      Employee.countDocuments(),
      Attendance.countDocuments({ date, status: "Present" }),
      Attendance.countDocuments({ date, status: "Absent" }),
      Attendance.countDocuments({ date, status: "Leave" }),
      Leave.countDocuments({ status: "Pending" }),
      Announcement.countDocuments(),
      Training.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        totalEmployees,
        presentToday,
        absentToday,
        onLeaveToday,
        pendingLeaves,
        totalAnnouncements,
        totalTrainings,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message,
    });
  }
});

// ==================== START SERVER ====================

async function startServer() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/StaffSync"
    );

    console.log("MongoDB connected successfully!");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`StaffSync server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
