require('dotenv').config();
var config = require('./dbconfig');
const sql = require('mssql');
const dateFns = require('date-fns');

const TaskListQueryText = "SELECT ROW_NUMBER() OVER (ORDER BY dmis_tasks.task_id DESC) AS id, " +
    "dmis_tasks.task_id, " +
    "dmis_tasks.level_id, " +
    "dmis_tasks.task_issue, " +
    "dmis_tasks.task_solution, " +
    "dmis_tasks.task_date_start, " +
    "dmis_tasks.task_date_accept, " +
    "dmis_tasks.task_date_process, " +
    "dmis_tasks.task_date_end, " +
    "dmis_tasks.task_cost, " +
    "dmis_tasks.task_serialnumber, " +
    "dmis_tasks.task_device_id, " +
    "dmis_tasks.task_phone_no, " +
    "dmis_tasks.task_note, " +
    "dmis_tasks.status_id, " +
    "dmis_task_status.status_name, " +
    "dmis_tasks.informer_id, " +
    "inf.personnel_firstname AS informer_firstname, " +
    "inf.personnel_lastname AS informer_lastname, " +
    "inf_pos.position_name AS informer_position_name, " +
    "inf_dpm.department_name AS informer_department_name, " +
    "inf_fac.faction_name AS informer_faction_name, " +
    "dmis_tasks.issue_department_id, " +
    "personnel_departments.department_name AS issue_department_name, " +
    "dmis_tasks.receiver_id, " +
    "rev.personnel_firstname AS receiver_firstname, " +
    "rev.personnel_lastname AS receiver_lastname, " +
    "dmis_tasks.operator_id, " +
    "oper.personnel_firstname AS operator_firstname, " +
    "oper.personnel_lastname AS operator_lastname, " +
    "dmis_tasks.category_id, " +
    "dmis_task_categories.category_name, " +
    "dmis_tasks.estimation_id, " +
    "dmis_task_estimation.estimation_name, " +
    "personnel_factions.faction_id " +
    "FROM dmis_tasks " +
    "INNER JOIN personnel inf ON inf.personnel_id = dmis_tasks.informer_id " +
    "LEFT JOIN personnel_positions inf_pos ON inf_pos.position_id = inf.position_id " +
    "LEFT JOIN personnel_departments inf_dpm ON inf_dpm.department_id = inf_pos.department_id " +
    "LEFT JOIN personnel_factions inf_fac ON inf_fac.faction_id = inf_dpm.faction_id " +
    "LEFT JOIN personnel rev ON rev.personnel_id = dmis_tasks.receiver_id " +
    "LEFT JOIN personnel oper ON oper.personnel_id = dmis_tasks.operator_id " +
    "LEFT JOIN dmis_task_status ON dmis_task_status.status_id = dmis_tasks.status_id " +
    "LEFT JOIN personnel_departments ON personnel_departments.department_id = dmis_tasks.issue_department_id " +
    "LEFT JOIN personnel_factions ON personnel_factions.faction_id = personnel_departments.faction_id " +
    "LEFT JOIN personnel_fields ON personnel_fields.field_id = personnel_factions.field_id " +
    "LEFT JOIN dmis_task_categories ON dmis_task_categories.category_id = dmis_tasks.category_id " +
    "LEFT JOIN dmis_task_estimation ON dmis_task_estimation.estimation_id = dmis_tasks.estimation_id ";

async function getNextTaskId(level_id) {
    let pool = await sql.connect(config);
    const result = await pool.request().input('level_id', sql.VarChar, level_id).query("SELECT TOP (1) task_id FROM dmis_tasks WHERE level_id = @level_id ORDER BY task_id DESC");

    if (result.recordset.length !== 0) {
        let tempYear = dateFns.format(dateFns.addYears(new Date(), 543), 'yy');
        let tempMonth = dateFns.format(dateFns.addYears(new Date(), 543), 'MM');
        console.log("last task_id = " + result.recordset[0].task_id);
        let tempIdSplit = result.recordset[0].task_id.split("-");
        console.log("year = " + tempIdSplit[0]);
        console.log("month = " + tempIdSplit[1]);
        let nextNum = parseInt(tempIdSplit[2]) + 1
        console.log("next num = " + nextNum);

        if (tempIdSplit[0] !== tempYear || tempIdSplit[1] !== tempMonth) {
            return dateFns.format(dateFns.addYears(new Date(), 543), 'yy-MM-001');
        }

        return (tempYear + "-" + tempMonth + "-" + String(nextNum).padStart(3, '0'));
    }
    else {
        return dateFns.format(dateFns.addYears(new Date(), 543), 'yy-MM-001');
    }

}

async function getPersonnelData(personnel_id) {
    console.log("let getPersonnelData");
    const controller = new AbortController();
    const signal = controller.signal;
    const result = await fetch(`http://${process.env.backendHost}:${process.env.psnDataDistPort}/api/getpersonnel/${personnel_id}`, { signal })
        .then((response) => response.json())
        .then((data) => {
            console.log("getPersonnelData complete");
            return data;
        })
        .catch((error) => {
            if (error.name === "AbortError") {
                console.log("cancelled");
            }
            else {
                console.error('Error:', error);
            }
        });
    controller.abort();
    return result;
}

async function addTask(task) {
    try {

        console.log("addTask call try to connect server id = " + task.informer_id + " name: " + task.informer_name);
        let pool = await sql.connect(config);
        console.log("connect complete");

        console.log("get next task index");
        const taskId = await getNextTaskId(task.level_id);
        console.log("new task index for " + task.level_id + " is " + taskId);

        await pool.request()
            .input('task_id', sql.VarChar, taskId)
            .input('level_id', sql.VarChar, task.level_id)
            .input('task_issue', sql.Text, task.task_issue)
            .input('task_serialnumber', sql.VarChar, task.task_serialnumber)
            .input('task_device_id', sql.VarChar, task.task_device_id)
            .input('status_id', sql.TinyInt, 1)
            .input('informer_id', sql.VarChar, task.informer_id)
            .input('issue_department_id', sql.Int, task.issue_department_id)
            .query("INSERT INTO dmis_tasks (task_id, level_id, task_issue, task_date_start, task_serialnumber, task_device_id, status_id, informer_id, issue_department_id)" +
                "VALUES (@task_id, @level_id, @task_issue, GETDATE(), @task_serialnumber, @task_device_id, @status_id, @informer_id, @issue_department_id)");
        console.log("addTask complete");

        let token = "";

        if (task.level_id === "DMIS_IT") {
            token = process.env.DMIS_IT_lineToken;
        }
        else if (task.level_id === "DMIS_MT") {
            token = process.env.DMIS_MT_lineToken;
        }
        else if (task.level_id === "DMIS_MER") {
            token = process.env.DMIS_MER_lineToken;
        }
        let phoneNumber = "ผู้แจ้งไม่ได้กรอกเบอร์ติดต่อ";
        if (task.phoneNumber !== "") {
            phoneNumber = "เบอร์โทรติดต่อ: " + task.phoneNumber;
        }
        let taskDeviceId = "ผู้แจ้งไม่ได้กรอกรหัสทรัพย์สิน";
        if (task.task_device_id !== "") {
            taskDeviceId = "รหัสทรัพย์สิน: " + task.task_device_id;
        }

        const sendMessage = { "message": "มีการแจ้งซ่อมใหม่\nเลขที่: " + taskId + "\n" + taskDeviceId + "\nผู้แจ้ง: " + task.informer_name + "\nแผนกที่พบปัญหา: " + task.department_name + "\nปัญหาที่พบ: " + task.task_issue + "\n" + phoneNumber };


        console.log("try to send message to line notify");
        console.log("message = " + sendMessage.message);
        fetch(process.env.lineNotify, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${token}`,
            },
            body: new URLSearchParams(sendMessage)
        })
            .then((response) => response.json())
            .then((data) => {
                console.log(data);
                console.log("send data to line complete");
                console.log("====================");
            })
            .catch((error) => {
                console.error('Error:', error);
            });

        return { "status": "ok" };

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getTaskList(personnel_id, level_id, view_id, showcase) {

    try {
        console.log("getTaskList call");
        console.log("getTaskList as " + level_id);
        let result;
        const resData = await getPersonnelData(personnel_id);
        console.log("try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        if ((level_id === 'DMIS_IT' || level_id === 'DMIS_MT' || level_id === 'DMIS_MER') && showcase === "false") {
            console.log("level = " + level_id + " not showcase");
            result = await pool.request()
                .input('level_id', sql.VarChar, level_id)
                .query(TaskListQueryText + "WHERE dmis_tasks.level_id = @level_id AND dmis_tasks.status_id NOT IN (0,5) ");
        }
        else if (level_id === 'DMIS_HIT' && showcase === 'false') {
            console.log("level = " + level_id + " not showcase");
            result = await pool.request()
                .query(TaskListQueryText + "WHERE dmis_tasks.level_id = 'DMIS_IT' AND dmis_tasks.status_id NOT IN (0,5) ");
        }
        else if (level_id === 'DMIS_ENV' && showcase === 'false') {
            console.log("level = " + level_id + " not showcase");
            result = await pool.request()
                .query(TaskListQueryText + "WHERE (dmis_tasks.level_id = 'DMIS_MT' OR dmis_tasks.level_id = 'DMIS_MER') AND dmis_tasks.status_id NOT IN (0,5) ");
        }
        else if (level_id === 'DMIS_ALL' && showcase === 'false') {
            console.log("level = " + level_id + " not showcase");
            result = await pool.request()
                .query(TaskListQueryText + "WHERE dmis_tasks.status_id NOT IN (0,5) ");
        }
        else if (view_id === 'VDMIS_DPM') {
            console.log("department id = " + resData.department_id);
            result = await pool.request()
                .input('department_id', sql.Int, resData.department_id)
                .input('informer_id', sql.VarChar, personnel_id)
                .query(TaskListQueryText +
                    "WHERE dmis_tasks.issue_department_id = @department_id AND dmis_tasks.status_id NOT IN (0,5) OR dmis_tasks.informer_id = @informer_id AND dmis_tasks.status_id NOT IN (0,5) " +
                    "ORDER BY dmis_tasks.task_date_start ");
        }
        else if (view_id === 'VDMIS_FAC') {
            console.log("faction id = " + resData.faction_id);
            result = await pool.request()
                .input('faction_id', sql.Int, resData.faction_id)
                .input('informer_id', sql.VarChar, personnel_id)
                .query(TaskListQueryText +
                    "WHERE personnel_factions.faction_id = @faction_id AND dmis_tasks.status_id NOT IN (0,5) OR dmis_tasks.informer_id = @informer_id AND dmis_tasks.status_id NOT IN (0,5) " +
                    "ORDER BY dmis_tasks.task_date_start");
        }
        else if (view_id === 'VDMIS_FLD') {
            console.log("field id = " + resData.field_id);
            result = await pool.request()
                .input('field_id', sql.Int, resData.field_id)
                .input('informer_id', sql.VarChar, personnel_id)
                .query(TaskListQueryText +
                    "WHERE personnel_fields.field_id = @field_id AND dmis_tasks.status_id NOT IN (0,5) OR dmis_tasks.informer_id = @informer_id AND dmis_tasks.status_id NOT IN (0,5) " +
                    "ORDER BY dmis_tasks.task_date_start");
        }
        else if (view_id === 'VDMIS_ALL') {
            console.log("get all activate");
            result = await pool.request().query(TaskListQueryText + "WHERE dmis_tasks.status_id NOT IN (0,5) ORDER BY dmis_tasks.task_date_start");
        }
        console.log("getTaskList complete");
        console.log("====================");
        return result.recordsets;
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }

}

async function getCompleteTaskList(personnel_id, level_id, view_id, showcase) {
    try {

        console.log("getCompleteTaskList call");
        let result;
        const resData = await getPersonnelData(personnel_id);
        console.log("try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        if ((level_id === 'DMIS_IT' || level_id === 'DMIS_MT' || level_id === 'DMIS_MER') && showcase === "false") {
            console.log("level = " + level_id + " not showcase");
            result = await pool.request()
                .input('level_id', sql.VarChar, level_id)
                .query(TaskListQueryText + "WHERE dmis_tasks.level_id = @level_id AND dmis_tasks.status_id IN (0,5) ORDER BY dmis_tasks.task_id DESC");
        }
        else if (level_id === 'DMIS_HIT' && showcase === "false") {
            console.log("level = " + level_id + " not showcase");
            result = await pool.request()
                .query(TaskListQueryText + "WHERE dmis_tasks.level_id = 'DMIS_IT' AND dmis_tasks.status_id IN (0,5) ORDER BY dmis_tasks.task_id DESC");
        }
        else if (level_id === 'DMIS_ENV' && showcase === "false") {
            console.log("level = " + level_id + " not showcase");
            result = await pool.request()
                .query(TaskListQueryText + "WHERE (dmis_tasks.level_id = 'DMIS_MT' OR dmis_tasks.level_id = 'DMIS_MER') AND dmis_tasks.status_id IN (0,5) ORDER BY dmis_tasks.task_id DESC");
        }
        else if (level_id === 'DMIS_ALL' && showcase === "false") {
            console.log("level = " + level_id + " not showcase");
            result = await pool.request()
                .query(TaskListQueryText + "WHERE dmis_tasks.status_id IN (0,5) ORDER BY dmis_tasks.task_id DESC");
        }
        else if (view_id === 'VDMIS_DPM') {
            console.log("department id = " + resData.department_id);
            result = await pool.request()
                .input('department_id', sql.Int, resData.department_id)
                .input('informer_id', sql.VarChar, personnel_id)
                .query(TaskListQueryText +
                    "WHERE dmis_tasks.issue_department_id = @department_id AND dmis_tasks.status_id IN (0,5) OR dmis_tasks.informer_id = @informer_id AND dmis_tasks.status_id IN (0,5) " +
                    "ORDER BY dmis_tasks.task_id DESC");
        }
        else if (view_id === 'VDMIS_FAC') {
            console.log("faction id = " + resData.faction_id);
            result = await pool.request()
                .input('faction_id', sql.Int, resData.faction_id)
                .input('informer_id', sql.VarChar, personnel_id)
                .query(TaskListQueryText +
                    "WHERE personnel_factions.faction_id = @faction_id AND dmis_tasks.status_id IN (0,5) OR dmis_tasks.informer_id = @informer_id AND dmis_tasks.status_id IN (0,5) " +
                    "ORDER BY dmis_tasks.task_id DESC");

        }
        else if (view_id === 'VDMIS_FLD') {
            console.log("field id = " + resData.field_id);
            result = await pool.request()
                .input('field_id', sql.Int, resData.field_id)
                .input('informer_id', sql.VarChar, personnel_id)
                .query(TaskListQueryText +
                    "WHERE personnel_fields.field_id = @field_id AND dmis_tasks.status_id IN (0,5) OR dmis_tasks.informer_id = @informer_id AND dmis_tasks.status_id IN (0,5) " +
                    "ORDER BY dmis_tasks.task_id DESC");
        }
        else if (view_id === 'VDMIS_ALL') {
            console.log("get all activate");
            result = await pool.request().query(TaskListQueryText + "WHERE dmis_tasks.status_id IN (0,5) ORDER BY dmis_tasks.task_id DESC");
        }

        console.log("getCompleteTaskList complete");
        console.log("====================");
        return result.recordsets;

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getAllTaskList(personnel_id, level_id, view_id) {
    try {

        console.log("getAllTaskList call");
        let result;
        let itmtQuery = "";
        const resData = await getPersonnelData(personnel_id);
        console.log("try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        if (level_id === 'DMIS_IT' || level_id === 'DMIS_MT' || level_id === 'DMIS_MER') {
            itmtQuery = "OR dmis_tasks.level_id = '" + level_id + "'";
        }
        else if (level_id === 'DMIS_ENV') {
            itmtQuery = "OR dmis_tasks.level_id = 'DMIS_MT' OR dmis_tasks.level_id = 'DMIS_MER'";
        }
        else if (level_id === 'DMIS_HIT') {
            itmtQuery = "OR dmis_tasks.level_id = 'DMIS_IT'";
        }
        if (view_id === 'VDMIS_DPM') {
            console.log("department id = " + resData.department_id);
            result = await pool.request()
                .input('department_id', sql.Int, resData.department_id)
                .input('informer_id', sql.VarChar, personnel_id)
                .query(TaskListQueryText +
                    "WHERE dmis_tasks.issue_department_id = @department_id OR dmis_tasks.informer_id = @informer_id " + itmtQuery + " " +
                    "ORDER BY dmis_tasks.task_id DESC");
        }
        else if (view_id === 'VDMIS_FAC') {
            console.log("faction id = " + resData.faction_id);
            result = await pool.request()
                .input('faction_id', sql.Int, resData.faction_id)
                .input('informer_id', sql.VarChar, personnel_id)
                .query(TaskListQueryText +
                    "WHERE personnel_factions.faction_id = @faction_id OR dmis_tasks.informer_id = @informer_id " + itmtQuery + " " +
                    "ORDER BY dmis_tasks.task_id DESC");

        }
        else if (view_id === 'VDMIS_FLD') {
            console.log("field id = " + resData.field_id);
            result = await pool.request()
                .input('field_id', sql.Int, resData.field_id)
                .input('informer_id', sql.VarChar, personnel_id)
                .query(TaskListQueryText +
                    "WHERE personnel_fields.field_id = @field_id OR dmis_tasks.informer_id = @informer_id " + itmtQuery + " " +
                    "ORDER BY dmis_tasks.task_id DESC");
        }
        else if (view_id === 'VDMIS_ALL') {
            console.log("get all activate");
            result = await pool.request().query(TaskListQueryText + "ORDER BY dmis_tasks.task_id DESC");
        }

        console.log("getAllTaskList complete");
        console.log("====================");
        return result.recordsets;

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getTask(task_id, level_id) {
    try {

        console.log("getTask call try to connect to server task_id = " + task_id + " level_id = " + level_id);
        let pool = await sql.connect(config);
        console.log("connect complete");
        const result = await pool.request().input('task_id', sql.VarChar, task_id).input('level_id', sql.VarChar, level_id).query(TaskListQueryText +
            "WHERE dmis_tasks.task_id = @task_id AND dmis_tasks.level_id = @level_id");
        console.log("getTask complete");
        console.log("====================");
        return result.recordset;

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function acceptTask(task) {
    try {

        console.log("acceptTask call try to connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        await pool.request()
            .input('task_id', sql.VarChar, task.task_id)
            .input('level_id', sql.VarChar, task.level_id)
            .input('receiver_id', sql.VarChar, task.receiver_id)
            .input('operator_id', sql.VarChar, task.operator_id)
            .input('estimation_id', sql.TinyInt, task.estimation_id)
            .query("UPDATE dmis_tasks SET " +
                "receiver_id = @receiver_id, " +
                "operator_id = @operator_id, " +
                "task_date_accept = GETDATE(), " +
                "estimation_id = @estimation_id, " +
                "status_id = 2 " +
                "WHERE task_id = @task_id AND level_id = @level_id");
        console.log("acceptTask complete");

        let token = "";

        if (task.level_id === "DMIS_IT") {
            token = process.env.DMIS_IT_lineToken;
        }
        else if (task.level_id === "DMIS_MT") {
            token = process.env.DMIS_MT_lineToken;
        }
        else if (task.level_id === "DMIS_MER") {
            token = process.env.DMIS_MER_lineToken;
        }
        let operatorName = "\nยังไม่ได้ระบุผู้รับผิดชอบงาน";
        if (task.operator_name !== "") {
            operatorName = "\nผู้รับผิดชอบ: " + task.operator_name;
        }

        const sendMessage = { "message": "มีการรับงาน/มอบหมายงาน\nเลขที่: " + task.task_id + "\nผู้รับเรื่อง: " + task.receiver_name + "" + operatorName };


        console.log("try to send message to line notify");
        console.log("message = " + sendMessage.message);
        fetch(process.env.lineNotify, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${token}`,
            },
            body: new URLSearchParams(sendMessage)
        })
            .then((response) => response.json())
            .then((data) => {
                console.log(data);
                console.log("send data to line complete");
                console.log("====================");
            })
            .catch((error) => {
                console.error('Error:', error);
            });

        return { status: "ok" };
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function processTask(task) {
    try {

        console.log("processTask call try to connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        let queryText = "UPDATE dmis_tasks SET " +
            "task_solution = @task_solution, " +
            "task_cost = @task_cost, " +
            "task_serialnumber = @task_serialnumber, " +
            "task_device_id = @task_device_id, " +
            "status_id = @status_id, " +
            "operator_id = @operator_id, " +
            "category_id = @category_id, " +
            "task_phone_no = @task_phone_no, " +
            "task_note = @task_note, " +
            "estimation_id = @estimation_id, " +
            "task_date_process = GETDATE() ";
        if (task.status_id === 5) {
            queryText += ", task_date_end = GETDATE() ";
        }
        await pool.request()
            .input('task_id', sql.VarChar, task.task_id)
            .input('level_id', sql.VarChar, task.level_id)
            .input('task_solution', sql.Text, task.task_solution)
            .input('task_cost', sql.VarChar, task.task_cost)
            .input('task_serialnumber', sql.VarChar, task.task_serialnumber)
            .input('task_device_id', sql.VarChar, task.task_device_id)
            .input('status_id', sql.TinyInt, task.status_id)
            .input('operator_id', sql.VarChar, task.operator_id)
            .input('category_id', sql.TinyInt, task.category_id)
            .input('task_phone_no', sql.VarChar, task.task_phone_no)
            .input('task_note', sql.Text, task.task_note)
            .input('estimation_id', sql.TinyInt, task.estimation_id)
            .query(queryText + "WHERE task_id = @task_id AND level_id = @level_id");
        console.log("processTask complete");
        console.log("====================");
        return { status: "ok" };

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getOperator(level_id) {
    try {

        console.log("getOperator call try connect to server level_id = " + level_id);
        let pool = await sql.connect(config);
        console.log("connect complete");
        let levelCheck = "personnel_level_list.level_id = @level_id";
        if (level_id === 'DMIS_ENV') {
            levelCheck = "personnel_level_list.level_id = 'DMIS_ENV' OR personnel_level_list.level_id = 'DMIS_MT' OR personnel_level_list.level_id = 'DMIS_MER'";
        }
        else if (level_id === 'DMIS_HIT') {
            levelCheck = "personnel_level_list.level_id = 'DMIS_HIT' OR personnel_level_list.level_id = 'DMIS_IT'";
        }
        else if (level_id === 'DMIS_ALL') {
            levelCheck = "1=1";
        }
        const result = await pool.request().input('level_id', sql.VarChar, level_id)
            .query("SELECT personnel.personnel_id, personnel.personnel_firstname, personnel.personnel_lastname, personnel_level_list.level_id FROM personnel " +
                "INNER JOIN personnel_level_list ON personnel_level_list.personnel_id = personnel.personnel_id " +
                "WHERE " + levelCheck);
        console.log("getOperator complete");
        console.log("====================");
        return result.recordsets;
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getCategories(level_id) {
    try {

        console.log("getCategories call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        let levelCheck = "level_id = @level_id";
        if (level_id === 'DMIS_ENV') {
            levelCheck = "level_id = 'DMIS_MT' OR level_id = 'DMIS_MER'";
        }
        else if (level_id === 'DMIS_HIT') {
            levelCheck = "level_id = 'DMIS_IT'";
        }
        else if (level_id === 'DMIS_ALL') {
            levelCheck = "1=1";
        }
        const result = await pool.request().input('level_id', sql.VarChar, level_id).query("SELECT * FROM dmis_task_categories WHERE level_id = @level_id");
        console.log("getCategories complete");
        console.log("====================");
        return result.recordsets;

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getStatus() {
    try {

        console.log("getStatus call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        const result = await pool.request().query("SELECT * FROM dmis_task_status WHERE status_id NOT IN (1)");
        console.log("getStatus complete");
        console.log("====================");
        return result.recordsets;

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function getEstimation() {
    try {

        console.log("getEstimation call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        const result = await pool.request().query("SELECT * FROM dmis_task_estimation");
        console.log("getEstimation complete");
        console.log("====================");
        return result.recordsets;

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

async function countTask(personnel_id, level_id, view_id, showcase) {
    try {

        console.log("countTask call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        let result;
        let queryText = "SELECT COUNT(CASE WHEN dmis_tasks.status_id = 0 then 1 END) AS 'cancel', " +
            "COUNT(CASE WHEN dmis_tasks.status_id = 1 then 1 END) AS 'inform', " +
            "COUNT(CASE WHEN dmis_tasks.status_id = 2 then 1 END) AS 'accept', " +
            "COUNT(CASE WHEN dmis_tasks.status_id = 3 then 1 END) AS 'wait', " +
            "COUNT(CASE WHEN dmis_tasks.status_id = 4 then 1 END) AS 'outside', " +
            "COUNT(CASE WHEN dmis_tasks.status_id = 6 then 1 END) AS 'replace', " +
            "COUNT(CASE WHEN dmis_tasks.status_id = 5 then 1 END) AS 'complete' " +
            "FROM dmis_tasks " +
            "INNER JOIN personnel inf ON inf.personnel_id = dmis_tasks.informer_id " +
            "LEFT JOIN personnel rev ON rev.personnel_id = dmis_tasks.receiver_id " +
            "LEFT JOIN personnel oper ON oper.personnel_id = dmis_tasks.operator_id " +
            "INNER JOIN dmis_task_status ON dmis_task_status.status_id = dmis_tasks.status_id " +
            "INNER JOIN personnel_departments ON personnel_departments.department_id = dmis_tasks.issue_department_id " +
            "INNER JOIN personnel_factions ON personnel_factions.faction_id = personnel_departments.faction_id " +
            "INNER JOIN personnel_fields ON personnel_fields.field_id = personnel_factions.field_id ";


        const resData = await getPersonnelData(personnel_id);
        if ((level_id === "DMIS_IT" || level_id === "DMIS_MT" || level_id === "DMIS_MER") && showcase === "false") {
            console.log("level_id = " + level_id + " not showcase");
            result = await pool.request()
                .input('level_id', sql.VarChar, level_id)
                .query(queryText + "WHERE dmis_tasks.level_id = @level_id");
        }
        else if (level_id === 'DMIS_HIT' && showcase === "false") {
            console.log("level_id = " + level_id + " not showcase");
            result = await pool.request()
                .input('level_id', sql.VarChar, level_id)
                .query(queryText + "WHERE dmis_tasks.level_id = 'DMIS_IT'");
        }
        else if (level_id === 'DMIS_ENV' && showcase === "false") {
            console.log("level_id = " + level_id + " not showcase");
            result = await pool.request()
                .input('level_id', sql.VarChar, level_id)
                .query(queryText + "WHERE dmis_tasks.level_id = 'DMIS_MT' OR dmis_tasks.level_id = 'DMIS_MER'");
        }
        else if (level_id === 'DMIS_ALL' && showcase === "false") {
            console.log("level_id = " + level_id + " not showcase");
            result = await pool.request()
                .input('level_id', sql.VarChar, level_id)
                .query(queryText);
        }
        else if (view_id === 'VDMIS_DPM') {
            console.log("department id = " + resData.department_id);
            result = await pool.request()
                .input('department_id', sql.Int, resData.department_id)
                .input('informer_id', sql.VarChar, personnel_id)
                .query(queryText +
                    "WHERE dmis_tasks.issue_department_id = @department_id OR dmis_tasks.informer_id = @informer_id ");
        }
        else if (view_id === 'VDMIS_FAC') {
            console.log("faction id = " + resData.faction_id);
            result = await pool.request()
                .input('faction_id', sql.Int, resData.faction_id)
                .input('informer_id', sql.VarChar, personnel_id)
                .query(queryText +
                    "WHERE personnel_factions.faction_id = @faction_id OR dmis_tasks.informer_id = @informer_id ");

        }
        else if (view_id === 'VDMIS_FLD') {
            console.log("field id = " + resData.field_id);
            result = await pool.request()
                .input('field_id', sql.Int, resData.field_id)
                .input('informer_id', sql.VarChar, personnel_id)
                .query(queryText +
                    "WHERE personnel_fields.field_id = @field_id OR dmis_tasks.informer_id = @informer_id ");
        }
        else if (view_id === 'VDMIS_ALL') {
            console.log("get all activate");
            result = await pool.request().query(queryText);
        }

        console.log("countTask complete");
        console.log("====================");
        return result.recordset;
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

module.exports = {
    addTask: addTask,
    getTaskList: getTaskList,
    getCompleteTaskList: getCompleteTaskList,
    getAllTaskList: getAllTaskList,
    getTask: getTask,
    acceptTask: acceptTask,
    processTask: processTask,
    getOperator: getOperator,
    getCategories: getCategories,
    getStatus: getStatus,
    getEstimation: getEstimation,
    countTask: countTask,
}