require('dotenv').config();
var config = require('./dbconfig');
const sql = require('mssql');
const dateFns = require('date-fns');

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
    const result = await fetch(`http://192.168.15.35:5001/api/getpersonnel/${personnel_id}`)
        .then((response) => response.json())
        .then((data) => {
            console.log("getPersonnelData complete");
            return data;
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    return result;
}

async function addTask(task) {
    try {

        console.log("addTask call try to connect server id = " + task.informer_id);
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
            token = "RcimIzmzqH8Xwhje8XpRWWK5FYFkMHMx8ARbPhCWjkU";
        }
        else if (task.level_id === "DMIS_MT") {
            token = "eFkvLdfPbUsfHAI9UtHMbJlqH50ohjZJuhZlAQ5ykio";
        }
        let phoneNumber = "\nผู้แจ้งไม่ได้กรอกเบอร์ติดต่อ";
        if (task.phoneNumber !== "") {
            phoneNumber = "\nเบอร์โทรติดต่อ: " + task.phoneNumber;
        }

        const sendMessage = { "message": "มีการแจ้งซ่อมใหม่\nแผนก: " + task.department_name + "\nปัญหาที่พบ: " + task.task_issue + "" + phoneNumber };


        console.log("try to send message to line notify");
        console.log("message = " + sendMessage.message);
        fetch(`https://notify-api.line.me/api/notify`, {
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

async function getTaskList(personnel_id, level_id) {

    try {

        console.log("getTaskList call try to connect server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        console.log("getTaskList as " + level_id);
        let result;
        let queryText = "SELECT dmis_tasks.task_id, dmis_tasks.level_id, dmis_tasks.task_issue, " +
            "dmis_tasks.task_date_start, dmis_tasks.status_id, dmis_task_status.status_name, dmis_tasks.informer_id, inf.personnel_firstname AS informer_name, " +
            "dmis_tasks.issue_department_id, personnel_departments.department_name, dmis_tasks.receiver_id, rev.personnel_firstname AS receiver_firstname, " +
            "dmis_tasks.operator_id, oper.personnel_firstname AS operator_name, personnel_factions.faction_id " +
            "FROM dmis_tasks " +
            "INNER JOIN personnel inf ON inf.personnel_id = dmis_tasks.informer_id " +
            "LEFT JOIN personnel rev ON rev.personnel_id = dmis_tasks.receiver_id " +
            "LEFT JOIN personnel oper ON oper.personnel_id = dmis_tasks.operator_id " +
            "INNER JOIN dmis_task_status ON dmis_task_status.status_id = dmis_tasks.status_id " +
            "INNER JOIN personnel_departments ON personnel_departments.department_id = dmis_tasks.issue_department_id " +
            "INNER JOIN personnel_factions ON personnel_factions.faction_id = personnel_departments.faction_id " +
            "INNER JOIN personnel_fields ON personnel_fields.field_id = personnel_factions.field_id ";
        const resData = await getPersonnelData(personnel_id);
        if (level_id === 'DMIS_IT' || level_id === 'DMIS_MT') {
            console.log("level = " + level_id)
            result = await pool.request().input('level_id', sql.VarChar, level_id).query(queryText + "WHERE level_id = @level_id AND dmis_tasks.status_id NOT IN (0,5)");
        }
        else if (level_id === 'DMIS_U1') {
            console.log("department id = " + resData.department_id);
            result = await pool.request().input('department_id', sql.Int, resData.department_id).query(queryText +
                "WHERE issue_department_id = @department_id AND dmis_tasks.status_id NOT IN (0,5) " +
                "ORDER BY dmis_tasks.task_date_start");
        }
        else if (level_id === 'DMIS_U2') {
            console.log("faction id = " + resData.faction_id);
            result = await pool.request().input('faction_id', sql.Int, resData.faction_id).query(queryText +
                "WHERE personnel_factions.faction_id = @faction_id AND dmis_tasks.status_id NOT IN (0,5) " +
                "ORDER BY dmis_tasks.task_date_start");

        }
        else if (level_id === 'DMIS_U3') {
            console.log("field id = " + resData.field_id);
            result = await pool.request().input('field_id', sql.Int, resData.field_id).query(queryText +
                "WHERE personnel_fields.field_id = @field_id AND dmis_tasks.status_id NOT IN (0,5) " +
                "ORDER BY dmis_tasks.task_date_start");
        }
        else if (level_id === 'DMIS_U4') {
            console.log("U4 activate");
            result = await pool.request().query(queryText + "WHERE dmis_tasks.status_id NOT IN (0,5) ORDER BY dmis_tasks.task_date_start");
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

async function getCompleteTaskList(personnel_id, level_id) {
    try {

        console.log("getCompleteTaskList call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        let result;
        let queryText = "SELECT dmis_tasks.task_id, dmis_tasks.level_id, dmis_tasks.task_issue, " +
            "dmis_tasks.task_date_start, dmis_tasks.status_id, dmis_task_status.status_name, dmis_tasks.informer_id, inf.personnel_firstname AS informer_name, " +
            "dmis_tasks.issue_department_id, personnel_departments.department_name, dmis_tasks.receiver_id, rev.personnel_firstname AS receiver_firstname, " +
            "dmis_tasks.operator_id, oper.personnel_firstname AS operator_name, personnel_factions.faction_id " +
            "FROM dmis_tasks " +
            "INNER JOIN personnel inf ON inf.personnel_id = dmis_tasks.informer_id " +
            "LEFT JOIN personnel rev ON rev.personnel_id = dmis_tasks.receiver_id " +
            "LEFT JOIN personnel oper ON oper.personnel_id = dmis_tasks.operator_id " +
            "INNER JOIN dmis_task_status ON dmis_task_status.status_id = dmis_tasks.status_id " +
            "INNER JOIN personnel_departments ON personnel_departments.department_id = dmis_tasks.issue_department_id " +
            "INNER JOIN personnel_factions ON personnel_factions.faction_id = personnel_departments.faction_id " +
            "INNER JOIN personnel_fields ON personnel_fields.field_id = personnel_factions.field_id ";

        const resData = await getPersonnelData(personnel_id);
        if (level_id === 'DMIS_IT' || level_id === 'DMIS_MT') {
            console.log("level = " + level_id)
            result = await pool.request().input('level_id', sql.VarChar, level_id).query(queryText + "WHERE level_id = @level_id AND dmis_tasks.status_id IN (0,5) ORDER BY dmis_tasks.task_id DESC");
        }
        else if (level_id === 'DMIS_U1') {
            console.log("department id = " + resData.department_id);
            result = await pool.request().input('department_id', sql.Int, resData.department_id).query(queryText +
                "WHERE issue_department_id = @department_id AND dmis_tasks.status_id IN (0,5) " +
                "ORDER BY dmis_tasks.task_id DESC");
        }
        else if (level_id === 'DMIS_U2') {
            console.log("faction id = " + resData.faction_id);
            result = await pool.request().input('faction_id', sql.Int, resData.faction_id).query(queryText +
                "WHERE personnel_factions.faction_id = @faction_id AND dmis_tasks.status_id IN (0,5) " +
                "ORDER BY dmis_tasks.task_id DESC");

        }
        else if (level_id === 'DMIS_U3') {
            console.log("field id = " + resData.field_id);
            result = await pool.request().input('field_id', sql.Int, resData.field_id).query(queryText +
                "WHERE personnel_fields.field_id = @field_id AND dmis_tasks.status_id IN (0,5) " +
                "ORDER BY dmis_tasks.task_id DESC");
        }
        else if (level_id === 'DMIS_U4') {
            console.log("U4 activate");
            result = await pool.request().query(queryText + "WHERE dmis_tasks.status_id IN (0,5) ORDER BY dmis_tasks.task_id DESC");
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

async function getTask(task_id, level_id) {
    try {

        console.log("getTask call try to connect to server task_id = " + task_id + " level_id = " + level_id);
        let pool = await sql.connect(config);
        console.log("connect complete");
        const result = await pool.request().input('task_id', sql.VarChar, task_id).input('level_id', sql.VarChar, level_id).query("SELECT dmis_tasks.task_id, dmis_tasks.level_id, " +
            "dmis_tasks.task_issue, dmis_tasks.task_solution, dmis_tasks.task_date_start, dmis_tasks.task_date_end, dmis_tasks.task_cost, dmis_tasks.task_serialnumber, " +
            "dmis_tasks.task_device_id, dmis_tasks.task_phone_no, dmis_tasks.task_note, dmis_tasks.status_id, dmis_tasks.informer_id, dmis_tasks.issue_department_id, " +
            "dmis_tasks.receiver_id, dmis_tasks.operator_id, dmis_tasks.category_id, dmis_task_status.status_name FROM dmis_tasks " +
            "INNER JOIN dmis_task_status ON dmis_task_status.status_id = dmis_tasks.status_id " +
            "WHERE task_id = @task_id AND level_id = @level_id");
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
            .query("UPDATE dmis_tasks SET " +
                "receiver_id = @receiver_id, " +
                "operator_id = @operator_id, " +
                "status_id = 2 " +
                "WHERE task_id = @task_id AND level_id = @level_id");
        console.log("acceptTask complete");
        console.log("====================");
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
            "task_note = @task_note ";
        if (task.status_id === 5) {
            queryText += ", task_date_end = GETDATE() ";
        }
        await pool.request()
            .input('task_id', sql.VarChar, task.task_id)
            .input('level_id', sql.VarChar, task.level_id)
            .input('task_solution', sql.Text, task.task_solution)
            .input('task_cost', sql.Int, task.task_cost)
            .input('task_serialnumber', sql.VarChar, task.task_serialnumber)
            .input('task_device_id', sql.VarChar, task.task_device_id)
            .input('status_id', sql.TinyInt, task.status_id)
            .input('operator_id', sql.VarChar, task.operator_id)
            .input('category_id', sql.TinyInt, task.category_id)
            .input('task_phone_no', sql.VarChar, task.task_phone_no)
            .input('task_note', sql.Text, task.task_note)
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

        console.log("getOperator call try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        const result = await pool.request().input('level_id', sql.VarChar, level_id)
            .query("SELECT personnel.personnel_id, personnel.personnel_firstname, personnel.personnel_lastname FROM personnel " +
                "INNER JOIN personnel_level_list ON personnel_level_list.personnel_id = personnel.personnel_id " +
                "WHERE personnel_level_list.level_id = @level_id");
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

async function countTask(personnel_id, level_id) {
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
        if (level_id === "DMIS_IT" || level_id === "DMIS_MT") {
            console.log("level_id = " + level_id);
            result = await pool.request().input('level_id', sql.VarChar, level_id).query(queryText + "WHERE dmis_tasks.level_id = @level_id");
        }
        else if (level_id === 'DMIS_U1') {
            console.log("department id = " + resData.department_id);
            result = await pool.request().input('department_id', sql.Int, resData.department_id).query(queryText +
                "WHERE dmis_tasks.issue_department_id = @department_id ");
        }
        else if (level_id === 'DMIS_U2') {
            console.log("faction id = " + resData.faction_id);
            result = await pool.request().input('faction_id', sql.Int, resData.faction_id).query(queryText +
                "WHERE personnel_factions.faction_id = @faction_id " +
                "ORDER BY dmis_tasks.task_date_start");

        }
        else if (level_id === 'DMIS_U3') {
            console.log("field id = " + resData.field_id);
            result = await pool.request().input('field_id', sql.Int, resData.field_id).query(queryText +
                "WHERE personnel_fields.field_id = @field_id " +
                "ORDER BY dmis_tasks.task_date_start");
        }
        else if (level_id === 'DMIS_U4') {
            console.log("U4 activate");
            result = await pool.request().query(queryText + "ORDER BY dmis_tasks.task_date_start");
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
    getTask: getTask,
    acceptTask: acceptTask,
    processTask: processTask,
    getOperator: getOperator,
    getCategories: getCategories,
    getStatus: getStatus,
    countTask: countTask,
}