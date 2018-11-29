
Module.asmLibraryArg["_writecon"] = function (t) { 
        console.log(Pointer_stringify(t)); 
};

Module["intArrayToString"] = intArrayToString;
Module["getValue"] = getValue;
Module["cwrap"] = cwrap;

function escapeInp(t) {
    t = t.replace(/&/g, '&amp;');
    t = t.replace(/</g, '&lt;');
    t = t.replace(/>/g, '&gt;');
    t = t.replace(/\n/g, '<br/>');
    return t;
}
