const dboperations = require("./dboperations");

var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");
const { request, response } = require("express");
var app = express();
var router = express.Router();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  cors({
    origin: "*",
  })
);
app.use("/api/dmis", router);

router.use((request, response, next) => {
  //write authen here

  response.setHeader("Access-Control-Allow-Origin", "*"); //หรือใส่แค่เฉพาะ domain ที่ต้องการได้
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Credentials", true);

//   console.log("middleware");
  next();
});

router.route("/health").get((request, response) => {
  // console.log("health check");
  response.json({ status: 200 });
});

router.route("/addtask").post((request, response) => {
  let task = { ...request.body };
  dboperations
    .addTask(task)
    .then((result) => {
      response.status(201).json(result);
    })
    .catch((err) => {
      console.error(err);
      response.sendStatus(500);
    });
});

router
  .route("/gettasklist/:personnel_id/:level_id/:view_id/:showcase")
  .get((request, response) => {
    dboperations
      .getTaskList(
        request.params.personnel_id,
        request.params.level_id,
        request.params.view_id,
        request.params.showcase
      )
      .then((result) => {
        response.json(result);
      })
      .catch((err) => {
        console.error(err);
        response.sendStatus(500);
      });
  });

router
  .route("/getcompletetasklist/:personnel_id/:level_id/:view_id/:showcase")
  .get((request, response) => {
    dboperations
      .getCompleteTaskList(
        request.params.personnel_id,
        request.params.level_id,
        request.params.view_id,
        request.params.showcase
      )
      .then((result) => {
        response.json(result);
      })
      .catch((err) => {
        console.error(err);
        response.sendStatus(500);
      });
  });

router
  .route("/getalltasklist/:personnel_id/:level_id/:level_view")
  .get((request, response) => {
    dboperations
      .getAllTaskList(
        request.params.personnel_id,
        request.params.level_id,
        request.params.level_view
      )
      .then((result) => {
        response.json(result);
      })
      .catch((err) => {
        console.error(err);
        response.sendStatus(500);
      });
  });

router.route("/gettask/:task_id/:level_id").get((request, response) => {
  dboperations
    .getTask(request.params.task_id, request.params.level_id)
    .then((result) => {
      response.json(result);
    })
    .catch((err) => {
      console.error(err);
      response.sendStatus(500);
    });
});

router.route("/accepttask").post((request, response) => {
  let task = { ...request.body };
  dboperations
    .acceptTask(task)
    .then((result) => {
      response.status(201).json(result);
    })
    .catch((err) => {
      console.error(err);
      response.sendStatus(500);
    });
});

router.route("/processtask").post((request, response) => {
  let task = { ...request.body };
  dboperations
    .processTask(task)
    .then((result) => {
      response.status(201).json(result);
    })
    .catch((err) => {
      console.error(err);
      response.sendStatus(500);
    });
});

router.route("/getoperator/:level_id").get((request, response) => {
  dboperations
    .getOperator(request.params.level_id)
    .then((result) => {
      response.json(result);
    })
    .catch((err) => {
      console.error(err);
      response.setStatus(500);
    });
});

router.route("/getcategories/:level_id").get((request, response) => {
  dboperations
    .getCategories(request.params.level_id)
    .then((result) => {
      response.json(result);
    })
    .catch((err) => {
      console.error(err);
      response.setStatus(500);
    });
});

router.route("/getstatus").get((request, response) => {
  dboperations
    .getStatus()
    .then((result) => {
      response.json(result);
    })
    .catch((err) => {
      console.error(err);
      response.setStatus(500);
    });
});

router.route("/getestimation").get((request, response) => {
  dboperations
    .getEstimation()
    .then((result) => {
      response.json(result);
    })
    .catch((err) => {
      console.error(err);
      response.setStatus(500);
    });
});

router
  .route("/counttask/:personnel_id/:level_id/:view_id/:showcase")
  .get((request, response) => {
    dboperations
      .countTask(
        request.params.personnel_id,
        request.params.level_id,
        request.params.view_id,
        request.params.showcase
      )
      .then((result) => {
        response.json(result);
      })
      .catch((err) => {
        console.error(err);
        response.setStatus(500);
      });
  });

router.route("/getpermittasklist/:level_id").get((request, response) => {
  dboperations
    .getPermitTaskList(request.params.level_id)
    .then((result) => {
      response.json(result);
    })
    .catch((err) => {
      console.error(err);
      response.setStatus(500);
    });
});

router.route("/countpermittask/:level_id").get((request, response) => {
  dboperations
    .countPermitTask(request.params.level_id)
    .then((result) => {
      response.json(result);
    })
    .catch((err) => {
      console.error(err);
      response.setStatus(500);
    });
});

router
  .route("/getusrprmttasklist/:personnel_id/:view_id")
  .get((request, response) => {
    dboperations
      .getUserPermitTaskList(
        request.params.personnel_id,
        request.params.view_id
      )
      .then((result) => {
        response.json(result);
      })
      .catch((err) => {
        console.error(err);
        response.setStatus(500);
      });
  });

router
  .route("/getaudittasklist/:personnel_id/:view_id")
  .get((request, response) => {
    dboperations
      .getAuditTaskList(request.params.personnel_id, request.params.view_id)
      .then((result) => {
        response.json(result);
      })
      .catch((err) => {
        console.error(err);
        response.setStatus(500);
      });
  });

router
  .route("/getinformertasklist/:personnel_id/:view_id")
  .get((request, response) => {
    dboperations
      .getInformerTaskList(request.params.personnel_id, request.params.view_id)
      .then((result) => {
        response.json(result);
      })
      .catch((err) => {
        console.error(err);
        response.setStatus(500);
      });
  });

router
  .route("/countinfortask/:personnel_id/:view_id")
  .get((request, response) => {
    dboperations
      .countInformerTask(request.params.personnel_id, request.params.view_id)
      .then((result) => {
        response.json(result);
      })
      .catch((err) => {
        console.error(err);
        response.setStatus(500);
      });
  });

router.route("/getversion").get((request, response) => {
  dboperations
    .getVersion()
    .then((result) => {
      response.json(result);
    })
    .catch((err) => {
      console.error(err);
      response.setStatus(500);
    });
});

var port = process.env.PORT;
app.listen(port);
console.log("DMIS API is running at " + port);
