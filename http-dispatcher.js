var http = require("http");
var url = require('url');
var fs = require("fs");
var Sequelize = require('sequelize');
var sequelize = new Sequelize('node', 'node', 'node',
{
  host: 'localhost',
  dialect: 'mysql',
  pool: {
    max: 5,
    min: 0,
    idle: 10000
  }
});

var booking = sequelize.define('booking',
  {
    bookingId: {
      type: Sequelize.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      omitNull: true
    },
    bookingTime: Sequelize.STRING,
    fullname: Sequelize.STRING,
    slot: Sequelize.STRING,
    bookingDate: Sequelize.DATE
  },
  {
    timestamps: false, /* evita la colonna timestamp creata automaticamente */
    tableName: "booking"
  }
);

http.createServer(function(request, response){
  //var sequelize = new Sequelize('database', 'username', 'password',
  var body = [];
  var pathname = "";
  var result = {};
  if(request.method == 'POST'){
    request.on('error', function(err){
      console.error(err);
      result.code = -1;
      result.message = err;
    }).on('data', function(chunk){
      body.push(chunk);
    }).on('end', function(){
      body = Buffer.concat(body).toString();
      result.code = 0;
      result.message = "request completed successfully";
      pathname = request.url;
      console.log(pathname);
      dispatcher(body, response, pathname);
    });
  }else if(request.method == 'GET'){
    var params = url.parse(request.url, true);
    pathname = params.pathname;
    body = params.query;
    result.code = 0;
    result.message = "request completed successfully";
    dispatcher(body, response, pathname);
  }else{
    var params = url.parse(request.url, true);
    dispatcher(params.query, response, params.pathname);
  }
}).listen(1338);

console.log("VMT DEBUG: node server listening on port 1338");

function dispatcher(body, response, pathname){
  console.log("VMT DEBUG: PATH NAME - "+pathname);
  var result = {
    completed: 0,
    code: -1,
    message: "not executed"
  };
  response.writeHead(200,
    {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*', //http://localhost:8080
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    }
  );
  if(pathname=="/truncate"){
    result = truncate(response);
  }else if(pathname=="/add-or-update"){
    addOrUpdate(body, response);
  }else if(pathname=="/delete-booking"){
    deleteBooking(body, response);
  }else if(pathname=="/get-booking"){
    getBooking(body, response);
  }else if(pathname=="/delete-old-bookings"){
    deleteOldBookings(body, response);
  }else if(pathname=="/find-booking"){
    result.completed = 1;
    result.code = -1,
    result.message = "not yet implemented"
    response.end(JSON.stringify(result));
  }else if(pathname=="/get-bookings"){
    getBookings(response);
  }else if(pathname=="/get-paged-bookings"){
    getPagedBookings(body, response);
  }else{
    result.completed = 1;
    result.code = -1,
    result.message = "path not found"
    response.end(JSON.stringify(result));
  }
}

function truncate(res){
  var result =
  {
    completed: 0,
    code: -1,
    message: "failure"
  };
  booking.sync({force: true}).then(function(){
    result.completed = 1;
    result.code = 1;
    result.message = "Booking schema truncated";
    result.payload = [];
    console.log("VMT DEBUG: operation completed with success");
    res.end(JSON.stringify(result));
  });

}

function addOrUpdate(body, res){
  var result = {};
  var newBooking = JSON.parse(body);
  result.completed = 1;
  result.code = 1;
  result.message = "VMT booking added";
  result.payload = newBooking;
  persist(newBooking);
  res.end(JSON.stringify(result));
}

function persist(attrs){
  try{
    booking.findOne(
      {
        where:
        {
          bookingId: attrs.bookingId
        }
      }
    ).then(function(existing){
      if(existing){
        existing.updateAttributes(attrs).then(function(updated){
          console.log("VMT DEBUG: booking updated successfully");
          return;
        });
      }else{
        console.log("VMT DEBUG: new booking - persisting");
        booking.create({
            bookingId: null,
            bookingTime: attrs.bookingTime,
            fullname: attrs.fullname,
            slot: attrs.slot,
            bookingDate: attrs.bookingDate
        }).then(function(){
          console.log("VMT DEBUG: booking persisted");
          return true;
        });
      }
    });
  }catch(err){
    console.log(err);
  }
}

function deleteBooking(body, res){
  console.log("VMT DEBUG: inside deleteBooking with id = "+body.id);
  booking.findOne(
    {
      where:{
        bookingId: body.bookingId
      }
    }
  ).then(function(existing){
    if(existing){
      console.log("VMT DEBUG: BOOKING FOUND - being deleted");
      existing.destroy().then(function(){
        var result = {};
        result.completed = 1;
        result.code = 1;
        result.message = "Booking deleted";
        console.log("VMT DEBUG: returning result");
        res.end(JSON.stringify(result));
      });
    }else{
      console.log("VMT DEBUG: BOOKING NOT FOUND");
    }
  });
}

function deleteOldBookings(body, res){
  console.log("VMT DEBUG: inside deleteOldBooking with retention policy of "+body.delay+" hours");
  var now = new Date();
  now.setHours(now.getHours()-(parseInt(body.delay)));
  booking.destroy({
    where: {
        bookingDate: {$lt: now}
    }
  }).then(function(queryResult){
    console.log(queryResult);
    var result = {};
    result.completed = 1;
    result.code = 1;
    result.message = "Bookings deleted";
    result.payload = {}
    res.end(JSON.stringify(result));
  });
}

function getBooking(body, res){
  console.log("VMT DEBUG: inside getBooking with id = "+body.bookingId);
  booking.findOne(
    {
      where:{
        bookingId: body.bookingId
      }
    }
  ).then(function(existing){
    if(existing){
      console.log("VMT DEBUG: BOOKING FOUND - being returned");
      var result = {};
      result.completed = 1;
      result.code = 1;
      result.message = "Booking found";
      result.payload = existing
      res.end(JSON.stringify(result));
    }else{
      console.log("VMT DEBUG: BOOKING NOT FOUND");
    }
  });
}

function getBookings(res){
  console.log("VMT DEBUG: inside getBookings");
  var result =
  {
    completed: 0,
    code: -1,
    message: "failure"
  };
	/*
	*	query con restituzione di record multipli
	*/
	booking.findAll(
    {
      order: 'bookingTime ASC'
    }
  ).then(function(bookings) {
    if(bookings){
      result.code = bookings.length;
    }else{
      result.code = 0;
    }
    result.completed = 1;
    result.message = "Bookings fetched from DB";
    result.payload = bookings;
	  res.end(JSON.stringify(result));
	});
}

function getPagedBookings(body, res){
  console.log("VMT DEBUG: inside getPagedBookings");
  console.log(body);
  var result =
  {
    completed: 0,
    code: -1,
    message: "failure"
  };
	/*
	*	query con restituzione di record multipli
	*/
  var query =  "SELECT bookingId, bookingTime, fullname, slot FROM booking ORDER BY bookingTime ASC LIMIT "+body.offset+","+body.limit;
  sequelize.query(query, { type: sequelize.QueryTypes.SELECT}).then(function(bookings) {
    if(bookings){
      result.code = bookings.length;
    }else{
      result.code = 0;
    }
    result.completed = 1;
    result.message = "Bookings fetched from DB";
    result.payload = bookings;
	  res.end(JSON.stringify(result));
	});
}
