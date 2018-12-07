mergeInto(LibraryManager.library, {
    writecon: function(t) {
        console.log(Module.Pointer_stringify(t));
    }
});
