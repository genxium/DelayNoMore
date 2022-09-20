cc.Class({
  extends: cc.Component,
  properties: {
    
  },

  start() {
    
  },

  onLoad() {
  },

  update(dt) {
  },

  dismissDialog(postDismissalByYes, evt) {
    const self = this;
    const target = evt.target;
    self.node.parent.removeChild(self.node);
    if ("Yes" == target._name) {
      // This is a dirty hack!
      postDismissalByYes(); 
    } 
  }
});
