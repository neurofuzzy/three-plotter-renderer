module.exports = function(path) {

  if (path.indexOf("three.module.js") !== -1 && process.env.NODE_ENV === "npm") {
    return `three => THREE`;
  }
  
  return undefined;

};