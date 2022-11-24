require('dotenv').config();
var config = require('./dbconfig');
const sql = require('mssql');

async function getNextTaskId(level_id) {
    let pool = await sql.connect(config);
    const result = await pool.request().input('level_id', sql.VarChar, level_id).query("SELECT TOP (1) task_id FROM dmis_tasks WHERE level_id = @level_id ORDER BY task_id DESC");
    if (result.recordset.length === 0) {
        console.log("next task id for " + level_id + " is 1");
        return 1;
    }
    console.log("next task id for " + level_id + " is " + (result.recordset[0].task_id + 1));
    return result.recordset[0].task_id + 1;
}

async function getPersonnelData(personnel_id) {
    fetch(`http://localhost:5001/api/getpersonnel/${personnel_id}`)
        .then((response) => response.json())
        .then((data) => {
            return data.recordset[0];
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}

async function addTask(task) {
    try {

        console.log("addTask call try to connect server id = " + task.informer_id);
        let pool = await sql.connect(config);
        console.log("connect complete");

        console.log("get next task index");
        const taskId = await getNextTaskId(task.level_id);

        await pool.request()
            .input('task_id', sql.Int, taskId)
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
        console.log("====================");
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
        if (level_id === 'DMIS_IT' || level_id === 'DMIS_MT') {
            result = await pool.request().input('level_id', sql.VarChar, level_id).query("SELECT * FROM dmis_tasks WHERE level_id = @level_id");
        }
        else if (level_id === 'DMIS_U1') {
            console.log("get personnel deparment id = " + personnel_id);
            const resData = getPersonnelData(personnel_id);
            result = await pool.request().input('department_id', sql.Int, resData.departmentId).query("SELECT * FROM dmis_tasks WHERE issue_department_id = @department_id");
        }
        else if (level_id === 'DMIS_U2') {
            console.log("get personnel faction id = " + personnel_id);
            const resData = getPersonnelData(personnel_id);
            result = await pool.request().input('faction_id', sql.Int, resData.faction_id).query("SELECT * FROM dmis_tasks " +
                "INNER JOIN personnel_departments ON personnel_departments.department_id = dmis_tasks.issue_department_id " +
                "WHERE faction_id = @faction_id");

        }
        else if (level_id === 'DMIS_U3') {
            console.log("get personnel field id = " + personnel_id);
            const resData = getPersonnelData(personnel_id);
            result = await pool.request().input('field_id', sql.Int, resData.field_id).query("SELECT * FROM dmis_tasks " +
                "INNER JOIN personnel_departments ON personnel_departments.department_id = dmis_tasks.issue_department_id " +
                "INNER JOIN personnel_factions ON personnel_factions.faction_id = personnel_departments.faction_id " +
                "WHERE field_id = @field_id");
        }
        else if (level_id === 'DMIS_U4') {
            result = await pool.request().query("SELECT * FROM dmis_tasks");
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

async function getTask(task_id, level_id) {
    try {

        console.log("getTask call try to connect to server task_id = " + task_id + " level_id = " + level_id);
        let pool = await sql.connect(config);
        console.log("connect complete");
        const result = await pool.request().input('task_id', sql.Int, task_id).input('level_id', sql.VarChar, level_id).query("SELECT * FROM dmis_tasks WHERE task_id = @task_id AND level_id = @level_id");
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
            .input('task_id', sql.Int, task.task_id)
            .input('level_id', sql.VarChar, task.level_id)
            .input('receiver_id', sql.VarChar, task.receiver_id)
            .input('operator_id', sql.VarChar, task.operator_id)
            .query("UPDATE dmis_tasks SET "+
            "receiver_id = @receiver_id, "+
            "operator_id = @operator_id, "+
            "status_id = 2 "+
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

async function completeTask(task) {
    try {

        console.log("completeTask call try to connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");
        await pool.request()
        .input('task_id', sql.Int, task.task_id)
        .input('level_id', sql.VarChar, task.level_id)
        .input('task_solution', sql.Text, task.task_solution)
        .input('task_cost', sql.Int, task.task_cost)
        .input('task_serialnumber', sql.VarChar, task.task_serialnumber)
        .input('task_device_id', sql.VarChar, task.task_device_id)
        .input('operator_id', sql.VarChar, task.operator_id)
        .input('category_id', sql.TinyInt, task.category_id)
        .query("UPDATE dmis_tasks SET "+
        "task_solution = @task_solution, "+
        "task_date_end = GETDATE(), "+
        "task_cost = @task_cost, "+
        "task_serialnumber = @task_serialnumber, "+
        "task_device_id = @task_device_id, "+
        "status_id = 3, "+
        "operator_id = @operator_id, "+
        "category_id = @category_id "+
        "WHERE task_id = @task_id AND level_id = @level_id");
        console.log("completeTask complete");
        console.log("====================");
        return { status: "ok" };

    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

module.exports = {
    addTask: addTask,
    getTaskList: getTaskList,
    getTask: getTask,
    acceptTask: acceptTask,
    completeTask: completeTask,
}